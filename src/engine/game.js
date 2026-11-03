import { getEffectProgram, getEquipmentProgram, getTriggerProgram } from './effects.js';
import { supportedTransformationIds, transformationRequirementMet } from './transformations.js';

export class RuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }
}

const clone = (value) => structuredClone(value);
const makeRng = (seed) => {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
};
const shuffle = (items, rng) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const same = (a, b) => a === b;
const fail = (code, message) => { throw new RuleError(code, message); };

function indexCards(cards) {
  return cards instanceof Map ? cards : new Map(cards.map((card) => [card.id, card]));
}

export function validateRegistration(deck, cardIndex) {
  const errors = [];
  const mainIds = deck?.mainIds ?? [];
  const equipmentIds = deck?.equipmentIds ?? [];
  if (mainIds.length < 40 || mainIds.length > 60) errors.push('Main Deck must contain 40–60 cards.');
  const copies = new Map();
  let finishers = 0;
  for (const id of mainIds) {
    const card = cardIndex.get(id);
    if (!card) { errors.push(`Unknown card ID ${id} in Main Deck.`); continue; }
    if (!['Character', 'Ability', 'Speed Ability', 'Finisher'].includes(card.type) || card.transformation) errors.push(`${card.name} cannot be registered in Main Deck.`);
    copies.set(id, (copies.get(id) ?? 0) + 1);
    if (card.type === 'Finisher') finishers += 1;
  }
  let slots = 0;
  for (const id of equipmentIds) {
    const card = cardIndex.get(id);
    if (!card) { errors.push(`Unknown card ID ${id} in Equipment/Transformation Deck.`); continue; }
    if (card.type === 'Equipment') slots += 1;
    else if (card.type === 'Character' && card.transformation) slots += 2;
    else errors.push(`${card.name} cannot be registered in Equipment/Transformation Deck.`);
    copies.set(id, (copies.get(id) ?? 0) + 1);
  }
  if (slots !== 20) errors.push(`Equipment/Transformation Deck currently occupies ${slots} of 20 slots.`);
  for (const [id, count] of copies) if (count > 3) errors.push(`${id} has ${count} copies registered; the limit is 3.`);
  if (finishers > 6) errors.push(`Main Deck contains ${finishers} Finishers; the limit is 6.`);
  return { valid: errors.length === 0, errors, mainCount: mainIds.length, equipmentSlots: slots, finisherCount: finishers };
}

function createInstance({ id, cardId, ownerId, zone, physicalCopyId = id, usage = null }) {
  return { instanceId: id, physicalCopyId, cardId, ownerId, controllerId: ownerId, zone, attachedTo: null, battlefield: null, usage: usage ? clone(usage) : { attackedThisTurn: false, nameLimits: {} } };
}

function maxHp(instance, cardIndex, isCenter = false) {
  const card = cardIndex.get(instance.cardId);
  return (card?.statistics?.hp ?? 0) + (isCenter ? 13000 : 0);
}

/** Create a two-player game from the canonical card records and registered card IDs. */
export function createInitialState({ players, firstPlayerId, chooserId, seed = 1, cards }) {
  const cardIndex = indexCards(cards);
  if (!Array.isArray(players) || players.length !== 2) fail('PLAYER_COUNT', 'This rules edition requires exactly two players.');
  const ids = players.map((p) => p.id);
  if (new Set(ids).size !== 2 || ids.some((id) => !id)) fail('PLAYER_IDS', 'Players must have distinct nonempty IDs.');
  if (!ids.includes(firstPlayerId) || !ids.includes(chooserId)) fail('FIRST_PLAYER', 'First-player chooser and starting player must be registered players.');
  const rng = makeRng(seed);
  const instances = {};
  const pstate = {};
  let nextInstance = 1;
  for (const player of players) {
    const registration = validateRegistration(player.deck, cardIndex);
    if (!registration.valid) fail('ILLEGAL_DECK', `${player.name ?? player.id}: ${registration.errors.join(' ')}`);
    const starterCard = cardIndex.get(player.startingMainId);
    if (!starterCard || starterCard.type !== 'Character' || starterCard.transformation || !player.deck.mainIds.includes(player.startingMainId)) fail('ILLEGAL_STARTER', 'Starting Main must be a nontransformed Character registered in the Main Deck.');
    const owned = (cardId, zone) => {
      const id = `${player.id}-C${String(nextInstance++).padStart(4, '0')}`;
      instances[id] = createInstance({ id, cardId, ownerId: player.id, zone });
      return id;
    };
    const registeredMain = player.deck.mainIds.map((cardId) => owned(cardId, 'mainDeck'));
    const starter = registeredMain.find((instanceId) => same(instances[instanceId].cardId, player.startingMainId));
    instances[starter].zone = 'center';
    const mainDeck = shuffle(registeredMain.filter((id) => id !== starter), rng);
    const hand = mainDeck.splice(0, 5);
    hand.forEach((id) => { instances[id].zone = 'hand'; });
    const arsenal = player.deck.equipmentIds.map((cardId) => owned(cardId, 'arsenal'));
    const starterInstance = instances[starter];
    starterInstance.battlefield = { currentHp: maxHp(starterInstance, cardIndex, true), maxHp: maxHp(starterInstance, cardIndex, true), position: 'center' };
    pstate[player.id] = {
      id: player.id,
      name: player.name ?? player.id,
      life: 15,
      resources: { momentum: 5, light: 0, darkness: 0 },
      zones: { mainDeck, hand, continue: [], revealed: [], arsenal, baseReserve: [] },
      center: starter,
      party: Array(6).fill(null),
      registration: { mainCount: player.deck.mainIds.length, equipmentIds: [...player.deck.equipmentIds] },
      turn: { standardAddUsed: false, freeCenterSwitchUsed: false, freeMainAttackUsed: false, freePartyAttackUsed: false, finisherCombatUsed: false, finisherDisabled: false, equipmentLockedInstanceIds: [], suppressNextEquipmentAbilities: false, nameLimits: {} }
    };
  }
  const opponentId = ids.find((id) => id !== firstPlayerId);
  return {
    schemaVersion: 1,
    status: 'setup',
    players: pstate,
    playerOrder: [firstPlayerId, opponentId],
    activePlayerId: firstPlayerId,
    firstPlayerChooserId: chooserId,
    turnNumber: 1,
    phase: 'mulligan',
    priorityPlayerId: firstPlayerId,
    phasePasses: 0,
    mulliganOrder: [firstPlayerId, opponentId],
    mulliganIndex: 0,
    instances,
    nextInstanceNumber: nextInstance,
    menu: null,
    pendingTriggers: [],
    nextTriggerGroupNumber: 1,
    nextEventNumber: 1,
    pendingMenuResolution: null,
    resolutionChoice: null,
    combat: null,
    log: [{ type: 'GAME_CREATED', playerIds: ids, firstPlayerId, chooserId }],
    randomSeed: seed >>> 0
  };
}

function addLog(state, event) { state.log.push({ ...event, turn: state.turnNumber, phase: state.phase }); }
function currentPlayer(state) { return state.players[state.activePlayerId]; }
function emptyPartyIndex(player) { return player.party.findIndex((id) => id === null); }

function advancePhase(state, cardIndex) {
  if (state.pendingTriggers.length) fail('TRIGGER_QUEUE_UNSUPPORTED', 'A phase cannot advance while unresolved triggers are pending in this partial engine.');
  state.phasePasses = 0;
  if (state.phase === 'main') state.phase = 'battle';
  else if (state.phase === 'battle') state.phase = 'end';
  else if (state.phase === 'end') {
    addLog(state, { type: 'PHASE_ADVANCED', phase: 'end', activePlayerId: state.activePlayerId });
    startNextTurn(state, cardIndex);
    return;
  } else fail('ILLEGAL_PHASE', 'The phase cannot advance now.');
  state.priorityPlayerId = state.activePlayerId;
  state.phasePasses = 0;
  addLog(state, { type: 'PHASE_ADVANCED', phase: state.phase, activePlayerId: state.activePlayerId });
}

function startNextTurn(state, cardIndex) {
  state.turnNumber += 1;
  state.activePlayerId = state.playerOrder[(state.playerOrder.indexOf(state.activePlayerId) + 1) % 2];
  for (const player of Object.values(state.players)) {
    player.turn.standardAddUsed = false;
    player.turn.freeCenterSwitchUsed = false;
    player.turn.freeMainAttackUsed = false;
    player.turn.freePartyAttackUsed = false;
    player.turn.finisherCombatUsed = false;
    player.turn.finisherDisabled = false;
    player.turn.equipmentLockedInstanceIds = [];
    player.turn.suppressNextEquipmentAbilities = false;
    player.turn.nameLimits = {};
    for (const instance of Object.values(state.instances)) instance.usage.nameLimits = {};
  }
  const player = currentPlayer(state);
  for (const instance of Object.values(state.instances)) if ((instance.characterSpecialsSuppressedUntilTurn ?? Infinity) <= state.turnNumber) delete instance.characterSpecialsSuppressedUntilTurn;
  player.resources.momentum += 5;
  player.resources.light += 1;
  player.resources.darkness += 1;
  if (player.zones.mainDeck.length === 0) {
    player.life = 0;
    state.status = 'finished';
    state.winnerId = state.playerOrder.find((id) => id !== player.id);
    addLog(state, { type: 'EMPTY_DECK_LOSS', playerId: player.id });
    return;
  }
  const drawn = player.zones.mainDeck.shift();
  state.instances[drawn].zone = 'hand';
  player.zones.hand.push(drawn);
  state.phase = 'main';
  state.priorityPlayerId = player.id;
  state.phasePasses = 0;
  state.menu = null;
  state.combat = null;
  addLog(state, { type: 'TURN_STARTED', playerId: player.id, drew: drawn, resources: { ...player.resources }, cardIndexSize: cardIndex.size });
}

function openMenu(state, initiatorId, select) {
  state.menu = { id: `M${state.log.length + 1}`, initiatorId, activeSelectId: `S${state.log.length + 1}`, selects: [select], priorityPlayerId: initiatorId, consecutivePasses: 0 };
  state.priorityPlayerId = initiatorId;
  state.phasePasses = 0;
  addLog(state, { type: 'MENU_OPENED', menuId: state.menu.id, initiatorId, select: select.kind });
}

function snapshotCharacter(state, instance, cardIndex) {
  const card = cardIndex.get(instance.cardId);
  return {
    instanceId: instance.instanceId, physicalCopyId: instance.physicalCopyId, cardId: instance.cardId,
    ownerId: instance.ownerId, controllerId: instance.controllerId, position: instance.battlefield?.position ?? null,
    currentHp: instance.battlefield?.currentHp ?? null, maxHp: instance.battlefield?.maxHp ?? null,
    printedAtk: card?.statistics?.atk ?? null,
    characterSpecialsSuppressedUntilTurn: instance.characterSpecialsSuppressedUntilTurn ?? null,
    subtypes: [...(card?.subtypes ?? [])], attachedEquipment: attachedEquipment(state, instance.instanceId).map((gear) => ({
      instanceId: gear.instanceId, cardId: gear.cardId, cost: clone(cardIndex.get(gear.cardId)?.cost ?? {})
    }))
  };
}

function collectEventTriggers(state, event, lastKnownCharacters, cardIndex) {
  const records = [];
  for (const source of lastKnownCharacters) {
    const program = getTriggerProgram(source.cardId);
    if (program?.event !== event.type || (source.characterSpecialsSuppressedUntilTurn ?? 0) > state.turnNumber) continue;
    if (program.requiresOtherAlliedCharacter && !event.defeated?.some((victim) => victim.controllerId === source.controllerId && victim.instanceId !== source.instanceId)) continue;
    const sourceCard = cardIndex.get(source.cardId);
    const controller = state.players[source.controllerId];
    if (!controller || (program.perNamePerTurn && controller.turn.nameLimits[sourceCard.name])) continue;
    if (program.perNamePerTurn) controller.turn.nameLimits[sourceCard.name] = true;
    const record = {
      id: `T${String(state.nextTriggerGroupNumber).padStart(4, '0')}-${String(records.length + 1).padStart(2, '0')}`,
      kind: program.kind, sourceInstanceId: source.instanceId, sourceCardId: source.cardId,
      controllerId: source.controllerId, sourceSnapshot: clone(source), eventSnapshot: clone(event),
      collectedAtTurn: state.turnNumber, status: 'pending'
    };
    records.push(record);
    addLog(state, { type: 'TRIGGER_COLLECTED', triggerId: record.id, cardId: record.sourceCardId, sourceInstanceId: record.sourceInstanceId, controllerId: record.controllerId, eventType: event.type, eventId: event.id });
  }
  if (records.length) {
    state.pendingTriggers.push({ id: `G${String(state.nextTriggerGroupNumber++).padStart(4, '0')}`, event: clone(event), records });
  }
}

function openNextTriggerMenu(state) {
  if (state.menu || state.resolutionChoice || state.status !== 'active' || !state.pendingTriggers.length) return;
  const group = state.pendingTriggers.shift();
  const otherPlayerId = state.playerOrder.find((id) => id !== state.activePlayerId);
  const ordered = [
    ...group.records.filter((record) => record.controllerId === state.activePlayerId),
    ...group.records.filter((record) => record.controllerId === otherPlayerId)
  ];
  if (!ordered.length) return;
  const selects = ordered.map((record) => ({
    id: record.id, kind: 'TRIGGER_EFFECT', playerId: record.controllerId,
    triggerId: record.id, cardId: record.sourceCardId, sourceInstanceId: record.sourceInstanceId,
    triggerKind: record.kind, eventSnapshot: record.eventSnapshot, sourceSnapshot: record.sourceSnapshot
  }));
  openMenu(state, state.activePlayerId, selects[0]);
  state.menu.selects = selects;
  state.menu.triggerGroupId = group.id;
  addLog(state, { type: 'TRIGGER_GROUP_OPENED', triggerGroupId: group.id, triggerIds: ordered.map((record) => record.id), priorityPlayerId: state.activePlayerId });
}

function resolveMenu(state, cardIndex) {
  const menu = state.menu;
  const selections = [...menu.selects].reverse();
  state.menu = null;
  state.priorityPlayerId = state.activePlayerId;
  state.phasePasses = 0;
  continueMenuResolution(state, cardIndex, selections, menu.id);
}

function resolveTriggerSelect(state, select, cardIndex) {
  if (select.triggerKind !== 'mickey-defeat') return false;
  const player = state.players[select.playerId];
  const main = state.instances[player.center];
  if (main?.battlefield) {
    const healed = Math.min(3000, main.battlefield.maxHp - main.battlefield.currentHp);
    main.battlefield.currentHp += healed;
    addLog(state, { type: 'HP_RESTORED', playerId: player.id, sourceCardId: select.cardId, sourceInstanceId: select.sourceInstanceId, targetId: main.instanceId, amount: healed, triggerId: select.triggerId });
  }
  if (player.party.filter(Boolean).length === 0) {
    if (player.zones.mainDeck.length === 0) {
      player.life = 0;
      state.status = 'finished';
      state.winnerId = state.playerOrder.find((id) => id !== player.id);
      addLog(state, { type: 'EMPTY_DECK_LOSS', playerId: player.id, triggerId: select.triggerId });
      return false;
    }
    const drawnId = player.zones.mainDeck.shift();
    state.instances[drawnId].zone = 'hand';
    player.zones.hand.push(drawnId);
    addLog(state, { type: 'CARD_DRAWN', playerId: player.id, instanceId: drawnId, sourceCardId: select.cardId, triggerId: select.triggerId });
    state.resolutionChoice = {
      id: `RC${select.triggerId}`, kind: 'DISCARD_ONE', playerId: player.id, triggerId: select.triggerId,
      cardId: select.cardId, options: [...player.zones.hand],
      prompt: 'Discard one card after Mickey’s defeat trigger draws a card.'
    };
    state.priorityPlayerId = player.id;
    return true;
  }
  addLog(state, { type: 'TRIGGER_RESOLVED', triggerId: select.triggerId, cardId: select.cardId, sourceInstanceId: select.sourceInstanceId, controllerId: player.id });
  return false;
}

function beginStockedMemoriesChoice(state, select, program, cardIndex) {
  const player = state.players[select.playerId];
  const revealedInstanceIds = player.zones.mainDeck.splice(0, program.revealCount);
  for (const instanceId of revealedInstanceIds) {
    state.instances[instanceId].zone = 'revealed';
    player.zones.revealed.push(instanceId);
  }
  const options = revealedInstanceIds.filter((id) => cardIndex.get(state.instances[id].cardId)?.type === program.addType);
  state.resolutionChoice = {
    id: `RC${state.log.length + 1}`, kind: 'STOCKED_MEMORIES', stage: 'ADD_ABILITY', playerId: player.id,
    sourceCardId: select.cardId, revealedInstanceIds: [...revealedInstanceIds], remainingRevealedIds: [...revealedInstanceIds],
    options, canDecline: true, prompt: 'Choose an Ability among the revealed cards to add to hand, or skip that optional instruction.'
  };
  addLog(state, { type: 'CARDS_REVEALED', playerId: player.id, sourceCardId: select.cardId, instanceIds: revealedInstanceIds, cardIds: revealedInstanceIds.map((id) => state.instances[id].cardId) });
}

function setStockedBottomOrderChoice(state, choice) {
  if (choice.remainingRevealedIds.length) {
    choice.stage = 'BOTTOM_REVEALED';
    choice.options = [...choice.remainingRevealedIds];
    choice.canDecline = false;
    choice.prompt = 'Choose the next revealed card to place on the bottom of your Main Deck.';
    return false;
  }
  state.resolutionChoice = null;
  return true;
}

function resumePausedMenuResolution(state, cardIndex) {
  const pending = state.pendingMenuResolution;
  state.pendingMenuResolution = null;
  if (pending) continueMenuResolution(state, cardIndex, pending.remainingSelections, pending.menuId, pending.originalSelectCount);
}

function continueMenuResolution(state, cardIndex, selections, menuId, originalSelectCount = selections.length) {
  for (let index = 0; index < selections.length; index += 1) {
    const select = selections[index];
    if (select.kind === 'TRIGGER_EFFECT') {
      const paused = resolveTriggerSelect(state, select, cardIndex);
      if (paused) {
        state.pendingMenuResolution = { menuId, remainingSelections: selections.slice(index + 1), pendingTriggerId: select.triggerId, originalSelectCount };
        return;
      }
    } else if (select.kind === 'ADD_TO_PARTY') {
      const player = state.players[select.playerId];
      const instance = state.instances[select.instanceId];
      if (!instance || instance.zone !== 'pending' || player.party[select.partyIndex] !== null) continue;
      const card = cardIndex.get(instance.cardId);
      if (!card || card.type !== 'Character' || card.transformation) continue;
      instance.zone = 'party';
      instance.battlefield = { currentHp: card.statistics.hp, maxHp: card.statistics.hp, position: `party-${select.partyIndex}` };
      player.party[select.partyIndex] = instance.instanceId;
      addLog(state, { type: 'CHARACTER_ADDED', playerId: player.id, instanceId: instance.instanceId, cardId: instance.cardId });
    } else if (select.kind === 'ATTACH_EQUIPMENT') {
      const player = state.players[select.playerId];
      const gear = state.instances[select.equipmentInstanceId];
      const host = state.instances[select.hostInstanceId];
      const gearCard = gear && cardIndex.get(gear.cardId);
      if (gear?.zone !== 'pending') continue;
      if (!host?.battlefield || host.controllerId !== player.id || !requirementsMet(gearCard, host, cardIndex)) {
        gear.zone = 'arsenal';
        player.zones.arsenal.push(gear.instanceId);
        addLog(state, { type: 'ATTACHMENT_FAILED', playerId: player.id, equipmentId: gear.instanceId, reason: 'Host or subtype requirement became illegal.' });
        continue;
      }
      gear.zone = 'attached'; gear.attachedTo = host.instanceId; gear.controllerId = host.controllerId;
      const suppressAbilitiesUntilTurn = player.turn.suppressNextEquipmentAbilities ? state.turnNumber + 2 : null;
      if (suppressAbilitiesUntilTurn) {
        gear.abilitiesSuppressedUntilTurn = suppressAbilitiesUntilTurn;
        player.turn.suppressNextEquipmentAbilities = false;
      }
      addLog(state, { type: 'EQUIPMENT_ATTACHED', playerId: player.id, equipmentId: gear.instanceId, hostId: host.instanceId, abilitiesSuppressedUntilTurn: suppressAbilitiesUntilTurn });
    } else if (select.kind === 'TRANSFORM') {
      const player = state.players[select.playerId];
      const base = state.instances[select.baseInstanceId];
      const form = state.instances[select.formInstanceId];
      const definition = form && cardIndex.get(form.cardId);
      if (!supportedTransformationIds().includes(definition?.id) || form.zone !== 'pending' || !base?.battlefield || base.controllerId !== player.id || base.cardId !== definition.transformation.base_id) {
        restorePendingTransformation(state, select);
        addLog(state, { type: 'TRANSFORMATION_FAILED', formInstanceId: select.formInstanceId, reason: 'The selected base or transformation is no longer legal.' });
        continue;
      }
      const isCenter = player.center === base.instanceId;
      const partyIndex = player.party.indexOf(base.instanceId);
      if (!isCenter && partyIndex < 0) {
        restorePendingTransformation(state, select);
        addLog(state, { type: 'TRANSFORMATION_FAILED', formInstanceId: form.instanceId, reason: 'The base left its Character Zone.' });
        continue;
      }
      base.zone = 'underlay'; base.battlefield = null; base.underlayFor = form.instanceId;
      form.zone = isCenter ? 'center' : 'party'; form.controllerId = player.id; form.usage = clone(base.usage);
      form.transformState = { underlayId: base.instanceId, reservedBaseId: select.reservedBaseId ?? null };
      const hp = maxHp(form, cardIndex, isCenter);
      form.battlefield = { currentHp: hp, maxHp: hp, position: isCenter ? 'center' : `party-${partyIndex}` };
      if (isCenter) player.center = form.instanceId;
      else player.party[partyIndex] = form.instanceId;
      for (const gear of attachedEquipment(state, base.instanceId)) {
        if (requirementsMet(cardIndex.get(gear.cardId), form, cardIndex)) { gear.attachedTo = form.instanceId; gear.controllerId = form.controllerId; }
        else returnAttachedEquipment(state, base.instanceId, gear.instanceId);
      }
      addLog(state, { type: 'CHARACTER_TRANSFORMED', playerId: player.id, baseInstanceId: base.instanceId, formInstanceId: form.instanceId, reserveId: select.reservedBaseId ?? null });
    } else if (select.kind === 'SWITCH_CENTER') {
      const player = state.players[select.playerId];
      const incoming = state.instances[select.partyInstanceId];
      const outgoing = state.instances[player.center];
      const partyIndex = player.party.indexOf(select.partyInstanceId);
      const incomingCard = incoming && cardIndex.get(incoming.cardId);
      const outgoingCard = outgoing && cardIndex.get(outgoing.cardId);
      if (partyIndex < 0 || !incoming?.battlefield || !outgoing?.battlefield || incomingCard?.transformation || outgoingCard?.transformation) {
        addLog(state, { type: 'CENTER_SWITCH_FAILED', playerId: player.id, incomingId: select.partyInstanceId, reason: 'A selected Character left its legal untransformed Character Zone.' });
        continue;
      }
      outgoing.battlefield.currentHp = Math.max(1, outgoing.battlefield.currentHp - 13000);
      outgoing.battlefield.maxHp = Math.max(1, outgoing.battlefield.maxHp - 13000);
      outgoing.battlefield.position = `party-${partyIndex}`;
      incoming.battlefield.currentHp += 13000;
      incoming.battlefield.maxHp += 13000;
      incoming.battlefield.position = 'center';
      player.center = incoming.instanceId;
      player.party[partyIndex] = outgoing.instanceId;
      addLog(state, { type: 'CENTER_SWITCHED', playerId: player.id, incomingId: incoming.instanceId, outgoingId: outgoing.instanceId, partyIndex });
    } else if (select.kind === 'PARTY_SWAP') {
      const player = state.players[select.playerId];
      for (const instanceId of select.instanceIds) {
        const partyIndex = player.party.indexOf(instanceId);
        const character = state.instances[instanceId];
        const characterCard = character && cardIndex.get(character.cardId);
        if (partyIndex < 0 || !character?.battlefield || characterCard?.transformation) {
          addLog(state, { type: 'PARTY_SWAP_TARGET_SKIPPED', playerId: player.id, instanceId, reason: 'The selected Character left its legal untransformed Party Zone.' });
          continue;
        }
        const lastKnown = snapshotCharacter(state, character, cardIndex);
        for (const eventType of ['character-left-battlefield', 'character-returned-to-hand']) {
          collectEventTriggers(state, { id: `E${String(state.nextEventNumber++).padStart(4, '0')}`, type: eventType, turn: state.turnNumber, instanceId, controllerId: character.controllerId }, [lastKnown], cardIndex);
        }
        for (const gear of attachedEquipment(state, instanceId)) {
          const gearCard = cardIndex.get(gear.cardId);
          for (const resource of ['light', 'darkness']) {
            const printed = gearCard?.cost?.[resource] ?? 0;
            player.resources[resource] += printed === 1 ? 1 : Math.floor(printed / 2);
          }
        }
        returnAttachedEquipment(state, instanceId);
        player.party[partyIndex] = null;
        character.zone = 'retired';
        character.battlefield = null;
        character.attachedTo = null;
        const replacementId = `${player.id}-C${String(state.nextInstanceNumber++).padStart(4, '0')}`;
        const replacement = createInstance({ id: replacementId, cardId: character.cardId, ownerId: character.ownerId, physicalCopyId: character.physicalCopyId, zone: 'hand', usage: character.usage });
        state.instances[replacementId] = replacement;
        player.zones.hand.push(replacementId);
        addLog(state, { type: 'PARTY_MEMBER_SWAPPED', playerId: player.id, oldInstanceId: instanceId, instanceId: replacementId, cardId: replacement.cardId });
      }
    } else if (select.kind === 'CARD_EFFECT') {
      const instance = state.instances[select.instanceId];
      const card = instance && cardIndex.get(instance.cardId);
      const program = getEffectProgram(select.cardId);
      if (instance && program?.kind === 'heal') {
        const targetId = program.target === 'attacked-character' ? state.combat?.targetId : select.targets?.[0];
        const target = state.instances[targetId];
        if (target?.battlefield && target.controllerId === select.playerId) {
          const eligible = (program.target !== 'attacked-character' || target.battlefield.currentHp < target.battlefield.maxHp / 2)
            && (program.requires ?? []).every((tag) => hasControlledSubtype(state, select.playerId, tag, cardIndex));
          if (eligible) {
            let amount = program.amount;
            const reduction = (select.healingReductions ?? []).filter((entry) => entry.targetId === targetId).reduce((sum, entry) => sum + entry.amount, 0);
            amount = Math.max(0, amount - reduction);
            if (program.bonus?.when === 'no-equipment' && !Object.values(state.instances).some((gear) => gear.zone === 'attached' && gear.attachedTo === targetId)) amount += program.bonus.amount;
            const restored = Math.min(target.battlefield.maxHp - target.battlefield.currentHp, amount);
            target.battlefield.currentHp += restored;
            addLog(state, { type: 'HP_RESTORED', playerId: select.playerId, sourceCardId: card.id, targetId, amount: restored, reducedBy: reduction });
          }
        }
      }
      if (instance && program?.kind === 'curaga-response') {
        for (const targetId of select.targets ?? []) {
          const target = state.instances[targetId];
          if (!target?.battlefield || target.controllerId !== select.playerId) continue;
          const reduction = (select.healingReductions ?? []).filter((entry) => entry.targetId === targetId).reduce((sum, entry) => sum + entry.amount, 0);
          const amount = Math.max(0, program.amount - reduction);
          const restored = Math.min(amount, target.battlefield.maxHp - target.battlefield.currentHp);
          target.battlefield.currentHp += restored;
          addLog(state, { type: 'HP_RESTORED', playerId: select.playerId, sourceCardId: card.id, targetId, amount: restored, reducedBy: reduction });
        }
      }
      if (instance && program?.kind === 'soul-sever') {
        const parent = selections.find((entry) => {
          if (entry.id !== select.responseToSelectId || entry.kind !== 'CARD_EFFECT' || entry.playerId === select.playerId || !entry.targets?.includes(select.targets?.[0])) return false;
          const healingProgram = getEffectProgram(entry.cardId);
          return healingProgram?.kind === 'heal' || healingProgram?.kind === 'curaga-response';
        });
        if (parent && parent.playerId !== select.playerId && parent.targets?.includes(select.targets?.[0])) {
          parent.healingReductions ??= [];
          parent.healingReductions.push({ targetId: select.targets[0], amount: program.reduceHealing, sourceSelectId: select.id });
          addLog(state, { type: 'HEALING_INTERRUPTED', playerId: select.playerId, sourceCardId: card.id, targetId: select.targets[0], amount: program.reduceHealing });
        }
      }
      if (instance && program?.kind === 'aether-channel') {
        const chosen = (select.requirementInstanceIds ?? []).map((id) => state.instances[id]);
        if (program.resourceChoices.includes(select.resourceChoice)) {
          const player = state.players[select.playerId];
          player.resources[select.resourceChoice] += program.amount;
          for (const character of chosen) if (character?.battlefield && character.controllerId === player.id && !player.turn.equipmentLockedInstanceIds.includes(character.instanceId)) player.turn.equipmentLockedInstanceIds.push(character.instanceId);
          addLog(state, { type: 'RESOURCE_GAINED', playerId: player.id, sourceCardId: card.id, resource: select.resourceChoice, amount: program.amount });
        }
      }
      if (instance && program?.kind === 'theurgy-charge') {
        state.players[select.playerId].resources.momentum += program.gain.momentum;
        state.players[select.playerId].turn.finisherDisabled = true;
        addLog(state, { type: 'RESOURCE_GAINED', playerId: select.playerId, sourceCardId: card.id, resource: 'momentum', amount: program.gain.momentum });
      }
      if (instance && program?.kind === 'armiger-preparation') {
        const player = state.players[select.playerId];
        player.resources.light += program.gain.light;
        player.resources.darkness += program.gain.darkness;
        player.turn.suppressNextEquipmentAbilities = true;
        addLog(state, { type: 'RESOURCE_GAINED', playerId: player.id, sourceCardId: card.id, resource: 'light', amount: program.gain.light });
        addLog(state, { type: 'RESOURCE_GAINED', playerId: player.id, sourceCardId: card.id, resource: 'darkness', amount: program.gain.darkness });
        addLog(state, { type: 'EQUIPMENT_ABILITY_SUPPRESSION_ARMED', playerId: player.id, sourceCardId: card.id, untilNextTurn: true });
      }
      if (instance && program?.kind === 'stocked-memories') beginStockedMemoriesChoice(state, select, program, cardIndex);
      if (instance && program?.kind === 'blade-awakening') {
        const player = state.players[select.playerId];
        const blade = state.instances[select.bladeInstanceId];
        const bladeCard = blade && cardIndex.get(blade.cardId);
        if (blade?.zone === 'pending' && bladeCard?.type === 'Character' && !bladeCard.transformation && (bladeCard.subtypes ?? []).includes('Blade')) {
          const partyIndex = emptyPartyIndex(player);
          if (partyIndex >= 0) {
            blade.zone = 'party';
            blade.controllerId = player.id;
            blade.battlefield = { currentHp: bladeCard.statistics.hp, maxHp: bladeCard.statistics.hp, position: `party-${partyIndex}` };
            blade.characterSpecialsSuppressedUntilTurn = state.turnNumber + 2;
            player.party[partyIndex] = blade.instanceId;
            addLog(state, { type: 'CHARACTER_ADDED', playerId: player.id, instanceId: blade.instanceId, cardId: blade.cardId, byCardId: card.id, standardAddUsed: false, characterSpecialsSuppressedUntilTurn: blade.characterSpecialsSuppressedUntilTurn });
          } else {
            blade.zone = 'hand';
            player.zones.hand.push(blade.instanceId);
            addLog(state, { type: 'CARD_RETURNED_TO_HAND', playerId: player.id, instanceId: blade.instanceId, reason: 'No Party Zone remained available.' });
          }
        }
      }
      if (instance && card?.type !== 'Character') {
        instance.zone = 'continue';
        state.players[instance.ownerId].zones.continue.push(instance.instanceId);
      }
      addLog(state, { type: 'EFFECT_RESOLVED', selectId: select.id, cardId: select.cardId, supported: !!program });
      if (state.resolutionChoice?.kind === 'STOCKED_MEMORIES') {
        state.pendingMenuResolution = { menuId, remainingSelections: selections.slice(index + 1), originalSelectCount };
        state.priorityPlayerId = state.resolutionChoice.playerId;
        return;
      }
    } else if (select.kind === 'COMBAT') {
      resolveCombat(state, cardIndex);
    } else {
      addLog(state, { type: 'UNSUPPORTED_SELECT_SKIPPED', selectId: select.id, reason: 'No registered effect program.' });
    }
    if (state.status === 'finished') break;
  }
  state.pendingMenuResolution = null;
  state.priorityPlayerId = state.activePlayerId;
  addLog(state, { type: 'MENU_RESOLVED', menuId, selectCount: originalSelectCount });
  for (const select of selections) {
    const program = select.kind === 'CARD_EFFECT' && getEffectProgram(select.cardId);
    if (program?.kind === 'curaga-response' && select.opponentSpeedActivated) {
      state.players[select.playerId].resources.momentum += program.opponentSpeedReward.amount;
      addLog(state, { type: 'RESOURCE_GAINED', playerId: select.playerId, sourceCardId: select.cardId, resource: 'momentum', amount: program.opponentSpeedReward.amount, afterMenuId: menuId });
    }
  }
  openNextTriggerMenu(state);
}

function hasControlledSubtype(state, playerId, subtype, cardIndex) {
  return [state.players[playerId].center, ...state.players[playerId].party].filter(Boolean)
    .some((id) => (cardIndex.get(state.instances[id]?.cardId)?.subtypes ?? []).includes(subtype));
}

function controlsDifferentNamedSubtypes(state, playerId, firstTag, secondTag, cardIndex) {
  const controlled = [state.players[playerId].center, ...state.players[playerId].party].filter(Boolean)
    .map((id) => state.instances[id]).filter((x) => x?.battlefield);
  return controlled.some((first) => (cardIndex.get(first.cardId)?.subtypes ?? []).includes(firstTag)
    && controlled.some((second) => second.instanceId !== first.instanceId
      && cardIndex.get(second.cardId)?.name !== cardIndex.get(first.cardId)?.name
      && (cardIndex.get(second.cardId)?.subtypes ?? []).includes(secondTag)));
}

function armigerRequirementMet(state, playerId, cardIndex, minimum = 3) {
  return [state.players[playerId].center, ...state.players[playerId].party].filter(Boolean).some((hostId) => {
    const host = state.instances[hostId];
    if (!host?.battlefield || !(cardIndex.get(host.cardId)?.subtypes ?? []).includes('Sword Wielder')) return false;
    return Object.values(state.instances).filter((gear) => gear.zone === 'attached' && gear.attachedTo === hostId && gear.controllerId === playerId).length >= minimum;
  });
}

function passiveEquipmentAttackBonus(state, hostId, cardIndex) {
  let bonus = 0;
  for (const gear of Object.values(state.instances).filter((x) => x.zone === 'attached' && x.attachedTo === hostId)) {
    if ((gear.abilitiesSuppressedUntilTurn ?? 0) > state.turnNumber) continue;
    const program = getEquipmentProgram(gear.cardId);
    const host = state.instances[hostId];
    if (program?.passiveAttackBonus && (!program.requiresDamage || host.battlefield.currentHp < host.battlefield.maxHp)) bonus += program.passiveAttackBonus;
  }
  return bonus;
}

function resolveCombat(state, cardIndex) {
  const combat = state.combat;
  if (!combat) return;
  const target = state.instances[combat.targetId];
  const initiator = state.players[combat.initiatorId];
  if (!target?.battlefield || target.controllerId === combat.initiatorId) {
    addLog(state, { type: 'COMBAT_FAILED', targetId: combat.targetId });
    state.combat = null;
    return;
  }
  const participants = combat.attackerIds.map((id) => state.instances[id]).filter((x) => x?.battlefield && x.controllerId === combat.initiatorId && !x.usage.attackedThisTurn);
  if (!participants.length) { state.combat = null; return; }
  const total = participants.reduce((sum, instance) => sum + (cardIndex.get(instance.cardId)?.statistics?.atk ?? 0) + passiveEquipmentAttackBonus(state, instance.instanceId, cardIndex), 0);
  const recipients = [target, ...combat.guardIds.map((id) => state.instances[id]).filter((x) => x?.battlefield && x.controllerId !== combat.initiatorId)];
  if (recipients.length === 0) { state.combat = null; return; }
  const share = Math.floor(total / recipients.length), remainder = total % recipients.length;
  const damageAssignments = recipients.map((recipient, index) => {
    let amount = share + (index === 0 ? remainder : 0);
    for (const gear of Object.values(state.instances).filter((x) => x.zone === 'attached' && x.attachedTo === recipient.instanceId)) {
      const program = getEquipmentProgram(gear.cardId);
      if (program?.combatDamageReduction) amount = Math.max(0, amount - program.combatDamageReduction);
    }
    return { recipient, amount, remainingHp: recipient.battlefield.currentHp - amount };
  });
  // Commit every recipient's HP change together before determining any defeat.
  for (const { recipient, amount, remainingHp } of damageAssignments) {
    recipient.battlefield.currentHp = remainingHp;
    addLog(state, { type: 'COMBAT_DAMAGE', targetId: recipient.instanceId, amount, remainingHp });
  }
  participants.forEach((instance) => { instance.usage.attackedThisTurn = true; });
  const declaredLead = combat.attackerIds[0];
  if (declaredLead === initiator.center) initiator.turn.freeMainAttackUsed = true;
  else initiator.turn.freePartyAttackUsed = true;
  const defeated = recipients.filter((x) => x.battlefield.currentHp <= 0);
  const lifeLoss = new Map();
  let momentumGain = 0;
  const defeatRecords = defeated.map((victim) => {
    const owner = state.players[victim.controllerId];
    const isMain = owner.center === victim.instanceId;
    const amount = isMain ? 2 : 1;
    lifeLoss.set(owner.id, (lifeLoss.get(owner.id) ?? 0) + amount);
    momentumGain += amount;
    return { victim, owner, isMain, amount, lastKnown: snapshotCharacter(state, victim, cardIndex) };
  });
  const lastKnownCharacters = state.playerOrder.flatMap((playerId) => {
    const owner = state.players[playerId];
    return [owner.center, ...owner.party].filter(Boolean).map((id) => snapshotCharacter(state, state.instances[id], cardIndex));
  });
  // Life loss and the resulting terminal check use the same simultaneous defeat event.
  for (const [ownerId, amount] of lifeLoss) state.players[ownerId].life = Math.max(0, state.players[ownerId].life - amount);
  initiator.resources.momentum += momentumGain;
  for (const { victim, owner, isMain } of defeatRecords) {
    returnAttachedEquipment(state, victim.instanceId);
    if (victim.transformState) {
      const underlay = state.instances[victim.transformState.underlayId];
      if (!underlay || underlay.zone !== 'underlay') fail('TRANSFORMATION_UNDERLAY_MISSING', 'A transformed Character must retain its exact base underlay.');
      if (isMain) {
        const reserve = state.instances[victim.transformState.reservedBaseId];
        if (!reserve || reserve.zone !== 'baseReserve' || reserve.cardId !== underlay.cardId) fail('TRANSFORMATION_RESERVE_MISSING', 'A transformed Main must have its reserved exact base copy.');
        owner.zones.baseReserve = owner.zones.baseReserve.filter((id) => id !== reserve.instanceId);
        const restoredId = `${owner.id}-C${String(state.nextInstanceNumber++).padStart(4, '0')}`;
        const restored = createInstance({ id: restoredId, physicalCopyId: reserve.physicalCopyId, cardId: reserve.cardId, ownerId: reserve.ownerId, zone: 'center', usage: victim.usage });
        restored.battlefield = { currentHp: maxHp(restored, cardIndex, true), maxHp: maxHp(restored, cardIndex, true), position: 'center' };
        state.instances[restoredId] = restored;
        reserve.zone = 'retired'; reserve.reservedFrom = null;
        owner.center = restoredId;
        victim.zone = 'continue'; victim.battlefield = null; victim.transformState = null;
        owner.zones.continue.push(victim.instanceId);
        underlay.zone = 'continue'; underlay.underlayFor = null; owner.zones.continue.push(underlay.instanceId);
        addLog(state, { type: 'TRANSFORMED_MAIN_RESTORED', defeatedFormId: victim.instanceId, baseUnderlayId: underlay.instanceId, instanceId: restoredId, physicalCopyId: restored.physicalCopyId });
      } else {
        owner.party = owner.party.map((id) => id === victim.instanceId ? null : id);
        victim.zone = 'continue'; victim.battlefield = null; victim.transformState = null;
        underlay.zone = 'continue'; underlay.underlayFor = null;
        owner.zones.continue.push(victim.instanceId, underlay.instanceId);
        addLog(state, { type: 'TRANSFORMED_PARTY_DEFEATED', formId: victim.instanceId, baseUnderlayId: underlay.instanceId });
      }
    } else if (isMain) {
      const oldId = victim.instanceId;
      const replacementId = `${owner.id}-C${String(state.nextInstanceNumber++).padStart(4, '0')}`;
      const replacement = createInstance({ id: replacementId, physicalCopyId: victim.physicalCopyId, cardId: victim.cardId, ownerId: victim.ownerId, zone: 'center', usage: victim.usage });
      const card = cardIndex.get(victim.cardId);
      replacement.battlefield = { currentHp: maxHp(replacement, cardIndex, true), maxHp: maxHp(replacement, cardIndex, true), position: 'center' };
      state.instances[replacementId] = replacement;
      victim.zone = 'retired'; victim.battlefield = null;
      owner.center = replacementId;
      addLog(state, { type: 'MAIN_REVIVED', oldInstanceId: oldId, instanceId: replacementId, physicalCopyId: replacement.physicalCopyId });
    } else {
      owner.party = owner.party.map((id) => id === victim.instanceId ? null : id);
      victim.zone = 'continue'; victim.battlefield = null;
      owner.zones.continue.push(victim.instanceId);
    }
    addLog(state, { type: 'BATTLE_DEFEAT', victimId: victim.instanceId, playerId: owner.id, mainCharacter: isMain });
  }
  if (defeatRecords.length) {
    const event = {
      id: `E${String(state.nextEventNumber++).padStart(4, '0')}`, type: 'character-defeated', turn: state.turnNumber,
      defeated: defeatRecords.map(({ owner, isMain, lastKnown }) => ({ ...lastKnown, controllerId: owner.id, wasMain: isMain }))
    };
    collectEventTriggers(state, event, lastKnownCharacters, cardIndex);
  }
  const down = state.playerOrder.filter((id) => state.players[id].life <= 0);
  if (down.length) { state.status = 'finished'; state.winnerId = down.length === 2 ? null : state.playerOrder.find((id) => !down.includes(id)); }
  state.combat = null;
}

function attachedEquipment(state, hostId) {
  return Object.values(state.instances).filter((x) => x.zone === 'attached' && x.attachedTo === hostId);
}

function returnAttachedEquipment(state, hostId, specificId = null) {
  for (const gear of attachedEquipment(state, hostId).filter((x) => !specificId || x.instanceId === specificId)) {
    gear.zone = 'arsenal'; gear.attachedTo = null; gear.controllerId = gear.ownerId;
    state.players[gear.ownerId].zones.arsenal.push(gear.instanceId);
  }
}

function restorePendingTransformation(state, select) {
  const player = state.players[select.playerId], form = state.instances[select.formInstanceId];
  if (form?.zone === 'pending') { form.zone = 'arsenal'; player.zones.arsenal.push(form.instanceId); }
  if (select.reservedBaseId) {
    const reserved = state.instances[select.reservedBaseId];
    if (!reserved || reserved.zone !== 'baseReserve') return;
    player.zones.baseReserve = player.zones.baseReserve.filter((id) => id !== reserved.instanceId);
    const origin = reserved.reservedFrom?.zone;
    reserved.reservedFrom = null;
    if (origin === 'hand') { reserved.zone = 'hand'; player.zones.hand.push(reserved.instanceId); }
    else if (origin === 'continue') { reserved.zone = 'continue'; player.zones.continue.push(reserved.instanceId); }
    else {
      reserved.zone = 'mainDeck'; player.zones.mainDeck.push(reserved.instanceId);
      const rng = makeRng((state.randomSeed + state.log.length + reserved.instanceId.length) >>> 0);
      player.zones.mainDeck = shuffle(player.zones.mainDeck, rng);
    }
  }
}

/** Pure reducer: validates the action, returns a new state, and throws RuleError on illegal actions. */
export function dispatch(stateInput, action, cards) {
  const state = clone(stateInput);
  const cardIndex = indexCards(cards);
  const player = state.players[action.playerId];
  if (!player) fail('UNKNOWN_PLAYER', 'Action player is not in this game.');

  if (state.phase === 'mulligan') {
    if (action.type !== 'MULLIGAN') fail('SETUP_ONLY', 'Complete both mulligan choices before taking game actions.');
    const expected = state.mulliganOrder[state.mulliganIndex];
    if (action.playerId !== expected) fail('MULLIGAN_ORDER', 'Mulligans resolve in starting-player order.');
    const returned = action.instanceIds ?? [];
    if (returned.length > 5 || new Set(returned).size !== returned.length || returned.some((id) => !player.zones.hand.includes(id))) fail('INVALID_MULLIGAN', 'Choose up to five distinct cards from your hand.');
    const rng = makeRng((state.randomSeed + state.log.length + returned.length) >>> 0);
    player.zones.hand = player.zones.hand.filter((id) => !returned.includes(id));
    returned.forEach((id) => { state.instances[id].zone = 'mainDeck'; });
    player.zones.mainDeck = shuffle([...player.zones.mainDeck, ...returned], rng);
    for (let i = 0; i < returned.length; i += 1) {
      if (!player.zones.mainDeck.length) { player.life = 0; state.status = 'finished'; state.winnerId = state.playerOrder.find((id) => id !== player.id); break; }
      const id = player.zones.mainDeck.shift(); state.instances[id].zone = 'hand'; player.zones.hand.push(id);
    }
    addLog(state, { type: 'MULLIGAN', playerId: player.id, count: returned.length });
    state.mulliganIndex += 1;
    if (state.mulliganIndex >= 2 && state.status !== 'finished') { state.phase = 'main'; state.priorityPlayerId = state.activePlayerId; state.status = 'active'; }
    return state;
  }

  if (state.resolutionChoice) {
    const choice = state.resolutionChoice;
    if (action.type !== 'RESOLVE_CHOICE' || action.playerId !== choice.playerId) fail('RESOLUTION_CHOICE_REQUIRED', 'The responsible player must make the pending resolution choice before play can continue.');
    if (choice.kind === 'STOCKED_MEMORIES') {
      if (action.choiceId !== choice.id) fail('ILLEGAL_RESOLUTION_CHOICE', 'This choice is no longer active.');
      if (choice.stage === 'ADD_ABILITY') {
        if (action.decline) {
          if (!choice.canDecline) fail('ILLEGAL_RESOLUTION_CHOICE', 'This effect choice cannot be declined.');
        } else {
          if (!choice.options.includes(action.instanceId)) fail('ILLEGAL_RESOLUTION_CHOICE', 'Choose a revealed Ability or decline the optional add.');
          const revealed = state.instances[action.instanceId];
          if (revealed?.zone !== 'revealed' || !player.zones.revealed.includes(revealed.instanceId) || cardIndex.get(revealed.cardId)?.type !== 'Ability') fail('ILLEGAL_RESOLUTION_CHOICE', 'The selected Ability is no longer among the revealed cards.');
          player.zones.revealed = player.zones.revealed.filter((id) => id !== revealed.instanceId);
          choice.remainingRevealedIds = choice.remainingRevealedIds.filter((id) => id !== revealed.instanceId);
          revealed.zone = 'hand';
          player.zones.hand.push(revealed.instanceId);
          addLog(state, { type: 'CARD_ADDED_TO_HAND', playerId: player.id, instanceId: revealed.instanceId, cardId: revealed.cardId, sourceCardId: choice.sourceCardId });
        }
        if (player.zones.hand.length) {
          choice.stage = 'BOTTOM_HAND';
          choice.options = [...player.zones.hand];
          choice.canDecline = false;
          choice.prompt = 'Choose one card from your hand to place on the bottom of your Main Deck.';
        } else if (setStockedBottomOrderChoice(state, choice)) resumePausedMenuResolution(state, cardIndex);
        return state;
      }
      if (choice.stage === 'BOTTOM_HAND') {
        if (!choice.options.includes(action.instanceId) || !player.zones.hand.includes(action.instanceId)) fail('ILLEGAL_RESOLUTION_CHOICE', 'Choose a current card from your hand.');
        player.zones.hand = player.zones.hand.filter((id) => id !== action.instanceId);
        const bottomed = state.instances[action.instanceId];
        bottomed.zone = 'mainDeck'; player.zones.mainDeck.push(bottomed.instanceId);
        addLog(state, { type: 'CARD_BOTTOMED_FROM_HAND', playerId: player.id, instanceId: bottomed.instanceId, cardId: bottomed.cardId, sourceCardId: choice.sourceCardId });
        if (setStockedBottomOrderChoice(state, choice)) resumePausedMenuResolution(state, cardIndex);
        return state;
      }
      if (choice.stage === 'BOTTOM_REVEALED') {
        if (!choice.options.includes(action.instanceId) || !player.zones.revealed.includes(action.instanceId) || !choice.remainingRevealedIds.includes(action.instanceId)) fail('ILLEGAL_RESOLUTION_CHOICE', 'Choose one of the remaining revealed cards to place on the Main Deck bottom.');
        player.zones.revealed = player.zones.revealed.filter((id) => id !== action.instanceId);
        choice.remainingRevealedIds = choice.remainingRevealedIds.filter((id) => id !== action.instanceId);
        const bottomed = state.instances[action.instanceId];
        bottomed.zone = 'mainDeck'; player.zones.mainDeck.push(bottomed.instanceId);
        addLog(state, { type: 'CARD_BOTTOMED_FROM_REVEAL', playerId: player.id, instanceId: bottomed.instanceId, cardId: bottomed.cardId, sourceCardId: choice.sourceCardId });
        if (setStockedBottomOrderChoice(state, choice)) resumePausedMenuResolution(state, cardIndex);
        return state;
      }
      fail('ILLEGAL_RESOLUTION_CHOICE', 'Unknown Stocked Memories choice step.');
    }
    if (choice.kind !== 'DISCARD_ONE' || !choice.options.includes(action.instanceId) || !player.zones.hand.includes(action.instanceId)) fail('ILLEGAL_RESOLUTION_CHOICE', 'Choose one card currently in your hand to discard.');
    player.zones.hand = player.zones.hand.filter((id) => id !== action.instanceId);
    state.instances[action.instanceId].zone = 'continue';
    player.zones.continue.push(action.instanceId);
    state.resolutionChoice = null;
    addLog(state, { type: 'CARD_DISCARDED', playerId: player.id, instanceId: action.instanceId, triggerId: choice.triggerId });
    addLog(state, { type: 'TRIGGER_RESOLVED', triggerId: choice.triggerId, cardId: choice.cardId, controllerId: player.id });
    resumePausedMenuResolution(state, cardIndex);
    return state;
  }
  if (action.type === 'RESOLVE_CHOICE') fail('NO_RESOLUTION_CHOICE', 'There is no pending resolution choice.');

  if (state.status !== 'active' && action.type !== 'START_GAME') fail('GAME_NOT_ACTIVE', 'The game is not active.');
  if (state.menu) {
    if (state.combat?.guardWindow) {
      if (action.playerId !== state.combat.defenderId) fail('NO_PRIORITY', 'Only the defender may declare guards in the combat declaration window.');
      if (action.type === 'ASSIGN_GUARDS') {
        if (state.combat.guardsDeclared) fail('GUARDS_ALREADY_DECLARED', 'All Allied Guards are declared at once before responses begin.');
        const chosen = action.guardInstanceIds ?? [];
        if (new Set(chosen).size !== chosen.length) fail('INVALID_GUARDS', 'Choose distinct Party Members.');
        const legal = chosen.map((id) => state.instances[id]);
        if (legal.some((instance) => !instance?.battlefield || instance.controllerId !== player.id || instance.battlefield.position === 'center' || instance.instanceId === state.combat.targetId || state.combat.attackerIds.includes(instance.instanceId))) fail('INVALID_GUARDS', 'Allied Guards must be distinct Party Members, excluding the original target and Chain attackers.');
        const cost = legal.length * 2;
        if (player.resources.momentum < cost) fail('INSUFFICIENT_RESOURCE', 'Pay 2 Momentum for each Allied Guard before responses.');
        player.resources.momentum -= cost;
        state.combat.guardIds = [...chosen];
        state.combat.guardsDeclared = true;
        addLog(state, { type: 'ALLIED_GUARDS_DECLARED', playerId: player.id, guardInstanceIds: chosen, cost });
        return state;
      }
      if (action.type === 'BEGIN_COMBAT_RESPONSES') {
        state.combat.guardsDeclared = true;
        state.combat.guardWindow = false;
        state.menu.priorityPlayerId = state.combat.initiatorId;
        state.menu.consecutivePasses = 0;
        state.priorityPlayerId = state.combat.initiatorId;
        addLog(state, { type: 'COMBAT_RESPONSES_BEGIN', playerId: state.combat.initiatorId });
        return state;
      }
      fail('GUARD_WINDOW_ACTION', 'Only Allied Guard declarations or response-window confirmation are legal before responses.');
    }
    if (action.playerId !== state.menu.priorityPlayerId) fail('NO_PRIORITY', 'Only the player with priority may act in this Menu.');
    if (action.type === 'PASS') {
      state.menu.consecutivePasses += 1;
      if (state.menu.consecutivePasses >= 2) resolveMenu(state, cardIndex);
      else state.menu.priorityPlayerId = state.playerOrder.find((id) => id !== action.playerId);
      state.priorityPlayerId = state.menu?.priorityPlayerId ?? state.activePlayerId;
      return state;
    }
    if (action.type === 'ASSIGN_GUARDS') {
      fail('GUARD_WINDOW_CLOSED', 'All Allied Guards must be declared before response actions begin.');
    }
    if (action.type === 'ACTIVATE_SPEED') {
      const instance = state.instances[action.instanceId];
      const card = instance && cardIndex.get(instance.cardId);
      const program = card && getEffectProgram(card.id);
      if (!instance || instance.zone !== 'hand' || card?.type !== 'Speed Ability' || !program) fail('ILLEGAL_SPEED', 'This Speed Ability has no registered, tested response program in the current engine slice.');
      if (player.turn.nameLimits[card.name]) fail('NAME_LIMIT', `${card.name} is limited to one activation per turn.`);
      const targets = action.targets ?? [];
      let responseToSelectId = null;
      if (program.kind === 'heal') {
        if (program.timing !== 'opponent-attack-response' || !state.combat || state.combat.initiatorId === player.id || state.combat.targetId !== targets[0]) fail('WRONG_TIMING', `${card.name} may be activated only when an opponent attacks its eligible target.`);
        const target = state.instances[targets[0]];
        if (!target?.battlefield || target.controllerId !== player.id || target.battlefield.currentHp >= target.battlefield.maxHp / 2) fail('ILLEGAL_TARGET', 'The target must be your attacked Character below half its maximum HP.');
        if (!(program.requires ?? []).every((tag) => hasControlledSubtype(state, player.id, tag, cardIndex))) fail('REQUIREMENT_FAILED', 'You do not control the required subtype.');
      } else if (program.kind === 'curaga-response') {
        const defenders = state.combat && state.combat.initiatorId !== player.id ? [state.combat.targetId, ...state.combat.guardIds] : [];
        if (program.timing !== 'opponent-attack-response' || targets.length !== 2 || targets[0] === targets[1]) fail('WRONG_TIMING', `${card.name} requires two different allies in the current combat.`);
        const [healer, other] = targets.map((id) => state.instances[id]);
        if (!healer?.battlefield || healer.controllerId !== player.id || !defenders.includes(healer.instanceId) || !(cardIndex.get(healer.cardId)?.subtypes ?? []).includes('Healer')
          || !other?.battlefield || other.controllerId !== player.id || !defenders.includes(other.instanceId)) fail('ILLEGAL_TARGET', 'Choose your Healer and a different allied Character involved in this combat.');
      } else if (program.kind === 'soul-sever') {
        const parent = state.menu.selects.find((entry) => {
          if (entry.kind !== 'CARD_EFFECT' || entry.playerId === player.id || entry.id !== action.responseToSelectId || !entry.targets?.includes(targets[0])) return false;
          const healingProgram = getEffectProgram(entry.cardId);
          return healingProgram?.kind === 'heal' || healingProgram?.kind === 'curaga-response';
        });
        if (program.timing !== 'opponent-speed-response' || !parent) fail('WRONG_TIMING', `${card.name} can only interrupt an opponent's pending combat healing effect.`);
        responseToSelectId = parent.id;
      } else fail('WRONG_TIMING', `${card.name} has no supported response timing.`);
      const cost = card.cost ?? { momentum: 0, light: 0, darkness: 0 };
      for (const key of ['momentum', 'light', 'darkness']) if ((player.resources[key] ?? 0) < (cost[key] ?? 0)) fail('INSUFFICIENT_RESOURCE', `Not enough ${key}.`);
      for (const key of ['momentum', 'light', 'darkness']) player.resources[key] -= cost[key] ?? 0;
      player.resources.momentum += 1;
      player.zones.hand.splice(player.zones.hand.indexOf(instance.instanceId), 1);
      instance.zone = 'pending';
      player.turn.nameLimits[card.name] = true;
      for (const pending of state.menu.selects) {
        if (pending.kind === 'CARD_EFFECT' && pending.cardId === 'CS1-394' && pending.playerId !== player.id) pending.opponentSpeedActivated = true;
      }
      state.menu.selects.push({ id: `S${state.log.length + 1}`, kind: 'CARD_EFFECT', playerId: player.id, instanceId: instance.instanceId, cardId: card.id, targets, ...(responseToSelectId ? { responseToSelectId } : {}) });
      state.menu.consecutivePasses = 0;
      state.menu.priorityPlayerId = state.playerOrder.find((id) => id !== action.playerId);
      state.priorityPlayerId = state.menu.priorityPlayerId;
      addLog(state, { type: 'SPEED_ABILITY_ACTIVATED', playerId: player.id, cardId: card.id, instanceId: instance.instanceId });
      return state;
    }
    fail('MENU_ACTION_UNSUPPORTED', 'This action is not implemented in the current engine slice.');
  }

  if (action.type === 'PASS_PRIORITY') {
    if (action.playerId !== state.priorityPlayerId) fail('NO_PRIORITY', 'Only the player with empty-window priority may pass.');
    if (state.phasePasses === 0) {
      state.phasePasses = 1;
      state.priorityPlayerId = state.playerOrder.find((id) => id !== action.playerId);
      addLog(state, { type: 'PHASE_PRIORITY_PASSED', playerId: action.playerId, consecutivePasses: 1 });
      return state;
    }
    addLog(state, { type: 'PHASE_PRIORITY_PASSED', playerId: action.playerId, consecutivePasses: 2 });
    advancePhase(state, cardIndex);
    return state;
  }
  if (action.playerId !== state.activePlayerId || action.playerId !== state.priorityPlayerId) fail('NOT_ACTIVE_PLAYER', 'Only the active player may act outside a Menu.');
  if (action.type === 'ADVANCE_PHASE') fail('PHASE_REQUIRES_PASSES', 'Both players must pass on the empty phase window before the phase advances.');
  if (action.type === 'ADD_TO_PARTY') {
    if (state.phase !== 'main') fail('WRONG_PHASE', 'Standard deployment is a Main Phase action.');
    if (player.turn.standardAddUsed) fail('ADD_USED', 'Standard Add to Party was already used this turn.');
    const instance = state.instances[action.instanceId];
    const card = instance && cardIndex.get(instance.cardId);
    const partyIndex = action.partyIndex ?? emptyPartyIndex(player);
    if (!instance || instance.zone !== 'hand' || instance.controllerId !== player.id || card?.type !== 'Character' || card.transformation) fail('ILLEGAL_ADD', 'Choose a base Character from your hand.');
    if (partyIndex < 0 || partyIndex >= 6 || player.party[partyIndex] !== null) fail('PARTY_ZONE_FULL', 'Choose an empty Party Zone.');
    player.zones.hand.splice(player.zones.hand.indexOf(instance.instanceId), 1); instance.zone = 'pending';
    player.turn.standardAddUsed = true;
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'ADD_TO_PARTY', playerId: player.id, instanceId: instance.instanceId, partyIndex });
    return state;
  }
  if (action.type === 'SWITCH_CENTER') {
    if (state.phase !== 'main') fail('WRONG_PHASE', 'Center switching is a Main Phase action.');
    if (player.turn.freeCenterSwitchUsed) fail('CENTER_SWITCH_USED', 'Your free Center switch was already used this turn.');
    const incoming = state.instances[action.partyInstanceId];
    const outgoing = state.instances[player.center];
    if (!incoming?.battlefield || incoming.controllerId !== player.id || !player.party.includes(incoming.instanceId)) fail('ILLEGAL_SWITCH_TARGET', 'Choose an untransformed Character from your Party.');
    if (cardIndex.get(incoming.cardId)?.transformation || cardIndex.get(outgoing.cardId)?.transformation) fail('TRANSFORMED_SWITCH', 'Transformed Characters cannot use the standard Center switch.');
    player.turn.freeCenterSwitchUsed = true;
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'SWITCH_CENTER', playerId: player.id, partyInstanceId: incoming.instanceId });
    return state;
  }
  if (action.type === 'PARTY_SWAP') {
    if (state.phase !== 'main') fail('WRONG_PHASE', 'Party Swap is a Main Phase action.');
    const targets = action.instanceIds ?? [];
    if (targets.length < 1 || targets.length > 2 || new Set(targets).size !== targets.length) fail('INVALID_PARTY_SWAP', 'Choose one or two distinct Party Members.');
    for (const instanceId of targets) {
      const target = state.instances[instanceId];
      if (!target?.battlefield || target.controllerId !== player.id || !player.party.includes(instanceId)) fail('ILLEGAL_SWAP_TARGET', 'Party Swap targets must be your Party Members.');
      if (cardIndex.get(target.cardId)?.transformation) fail('TRANSFORMED_SWAP', 'Transformed Characters cannot be moved by Party Swap.');
    }
    if (player.resources.momentum < 6) fail('INSUFFICIENT_RESOURCE', 'Party Swap costs 6 Momentum.');
    player.resources.momentum -= 6;
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'PARTY_SWAP', playerId: player.id, instanceIds: [...targets] });
    return state;
  }
  if (action.type === 'TRANSFORM') {
    if (state.phase !== 'main') fail('WRONG_PHASE', 'Transformation is a Main Phase action.');
    const form = state.instances[action.formInstanceId], formCard = form && cardIndex.get(form.cardId);
    const base = state.instances[action.baseInstanceId];
    if (!form || form.zone !== 'arsenal' || form.ownerId !== player.id || formCard?.type !== 'Character' || !formCard.transformation || !supportedTransformationIds().includes(formCard.id)) fail('UNSUPPORTED_TRANSFORMATION', 'Choose a registered transformation from your arsenal with an implemented entry condition.');
    if (!base?.battlefield || base.controllerId !== player.id || base.cardId !== formCard.transformation.base_id) fail('ILLEGAL_TRANSFORMATION_BASE', 'Choose the exact nontransformed base Character required by this form.');
    if (!transformationRequirementMet(state, formCard, base, player, cardIndex)) fail('TRANSFORMATION_REQUIREMENT', 'This form’s printed entry requirement is not met.');
    const isCenter = player.center === base.instanceId;
    let reserved = null;
    if (isCenter) {
      const exactCopies = [player.zones.continue, player.zones.hand, player.zones.mainDeck].flat();
      reserved = action.reserveInstanceId ? state.instances[action.reserveInstanceId] : exactCopies.map((id) => state.instances[id]).find((instance) => instance?.cardId === base.cardId);
      if (!reserved || reserved.cardId !== base.cardId || !exactCopies.includes(reserved.instanceId)) fail('MAIN_BASE_RESERVE_REQUIRED', 'A Main transformation requires another registered exact base copy from hand, Main Deck, or Continue?.');
    }
    const cost = formCard.cost ?? {};
    for (const key of ['momentum', 'light', 'darkness']) if (player.resources[key] < (cost[key] ?? 0)) fail('INSUFFICIENT_RESOURCE', `Not enough ${key} to transform.`);
    for (const key of ['momentum', 'light', 'darkness']) player.resources[key] -= cost[key] ?? 0;
    if (reserved) {
      const source = reserved.zone, sourceList = player.zones[source];
      reserved.reservedFrom = { zone: source, index: sourceList.indexOf(reserved.instanceId) };
      player.zones[source] = sourceList.filter((id) => id !== reserved.instanceId);
      reserved.zone = 'baseReserve'; player.zones.baseReserve.push(reserved.instanceId);
      if (source === 'mainDeck') {
        const rng = makeRng((state.randomSeed + state.log.length + reserved.instanceId.length) >>> 0);
        player.zones.mainDeck = shuffle(player.zones.mainDeck, rng);
      }
    }
    player.zones.arsenal = player.zones.arsenal.filter((id) => id !== form.instanceId);
    form.zone = 'pending';
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'TRANSFORM', playerId: player.id, baseInstanceId: base.instanceId, formInstanceId: form.instanceId, reservedBaseId: reserved?.instanceId ?? null });
    return state;
  }
  if (action.type === 'ATTACH_EQUIPMENT') {
    if (state.phase !== 'main') fail('WRONG_PHASE', 'Standard Equipment attachment is a Main Phase action.');
    const gear = state.instances[action.equipmentInstanceId], card = gear && cardIndex.get(gear.cardId), host = state.instances[action.hostInstanceId];
    if (!gear || gear.zone !== 'arsenal' || gear.ownerId !== player.id || card?.type !== 'Equipment') fail('ILLEGAL_EQUIPMENT', 'Choose Equipment from your own arsenal.');
    if (!host || host.controllerId !== player.id || !host.battlefield) fail('ILLEGAL_HOST', 'Equipment must attach to your Character.');
    if (player.turn.equipmentLockedInstanceIds.includes(host.instanceId)) fail('ATTACHMENT_LOCKED', 'An effect prevents Equipment from being attached to this Character this turn.');
    if (!requirementsMet(card, host, cardIndex)) fail('INCOMPATIBLE_HOST', 'The Character does not meet this Equipment’s printed subtype requirements.');
    const cost = card.cost ?? {};
    for (const key of ['light', 'darkness']) if (player.resources[key] < (cost[key] ?? 0)) fail('INSUFFICIENT_RESOURCE', `Not enough ${key}.`);
    player.resources.light -= cost.light ?? 0; player.resources.darkness -= cost.darkness ?? 0;
    player.zones.arsenal = player.zones.arsenal.filter((id) => id !== gear.instanceId);
    gear.zone = 'pending';
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'ATTACH_EQUIPMENT', playerId: player.id, equipmentInstanceId: gear.instanceId, hostInstanceId: host.instanceId });
    return state;
  }
  if (action.type === 'ACTIVATE_ABILITY') {
    if (state.phase !== 'main') fail('WRONG_PHASE', 'Ability cards normally activate in your Main Phase.');
    const instance = state.instances[action.instanceId], card = instance && cardIndex.get(instance.cardId);
    if (!instance || instance.zone !== 'hand' || card?.type !== 'Ability') fail('ILLEGAL_ABILITY', 'Choose an Ability card from your hand.');
    if (!getEffectProgram(card.id)) fail('UNIMPLEMENTED_EFFECT', `${card.name} has no validated engine program yet; it remains visible in the database but cannot be resolved.`);
    if (player.turn.nameLimits[card.name]) fail('NAME_LIMIT', `${card.name} is limited to one activation per turn.`);
    const program = getEffectProgram(card.id);
    let requirementInstanceIds = [];
    if (program.kind === 'aether-channel') {
      requirementInstanceIds = action.requirementInstanceIds ?? [];
      if (requirementInstanceIds.length !== 2 || new Set(requirementInstanceIds).size !== 2) fail('REQUIREMENT_TARGETS', 'Choose two distinct Characters for Aether Channel.');
      const selected = requirementInstanceIds.map((id) => state.instances[id]);
      if (selected.some((x) => !x?.battlefield || x.controllerId !== player.id) || cardIndex.get(selected[0]?.cardId)?.name === cardIndex.get(selected[1]?.cardId)?.name
        || !program.requires.every((tag) => selected.some((x) => (cardIndex.get(x.cardId)?.subtypes ?? []).includes(tag)))) fail('REQUIREMENT_FAILED', 'Choose a Mage and a differently named Warrior you control.');
      if (!program.resourceChoices.includes(action.resourceChoice)) fail('ILLEGAL_RESOURCE_CHOICE', 'Choose Light or Darkness.');
    } else if (program.kind === 'armiger-preparation') {
      if (!armigerRequirementMet(state, player.id, cardIndex, program.minimumAttachedEquipment)) fail('REQUIREMENT_FAILED', 'Armiger Preparation requires a Sword Wielder you control with at least three attached Equipment.');
    } else if (program.kind === 'stocked-memories') {
      // No target or additional activation cost; card selection is made during resolution.
    } else if (program.kind === 'blade-awakening') {
      const blade = state.instances[action.bladeInstanceId];
      const bladeCard = blade && cardIndex.get(blade.cardId);
      const discard = state.instances[action.activationCostInstanceId];
      const discardCard = discard && cardIndex.get(discard.cardId);
      if (!hasControlledSubtype(state, player.id, 'Driver', cardIndex) || hasControlledSubtype(state, player.id, 'Blade', cardIndex)) fail('REQUIREMENT_FAILED', 'Blade Awakening requires a Driver and no controlled Blade.');
      if (emptyPartyIndex(player) < 0) fail('PARTY_ZONE_FULL', 'Blade Awakening needs an empty Party Zone.');
      if (!blade || blade.zone !== 'hand' || blade.ownerId !== player.id || bladeCard?.type !== 'Character' || bladeCard.transformation || !(bladeCard.subtypes ?? []).includes('Blade')) fail('ILLEGAL_REVEAL', 'Reveal an untransformed Blade Character from your hand.');
      if (!discard || discard.instanceId === instance.instanceId || discard.instanceId === blade.instanceId || !player.zones.hand.includes(discard.instanceId) || discardCard?.type !== 'Ability') fail('ACTIVATION_COST_REQUIRED', 'Discard one other Ability card from your hand as the activation cost.');
      player.zones.hand = player.zones.hand.filter((id) => id !== discard.instanceId && id !== blade.instanceId);
      discard.zone = 'continue';
      player.zones.continue.push(discard.instanceId);
      blade.zone = 'pending';
      addLog(state, { type: 'CARD_REVEALED', playerId: player.id, sourceCardId: card.id, instanceId: blade.instanceId, cardId: blade.cardId });
      addLog(state, { type: 'ACTIVATION_COST_PAID', playerId: player.id, sourceCardId: card.id, cost: 'discard-ability', instanceId: discard.instanceId });
    } else if (program.kind !== 'theurgy-charge') {
      if (!action.targets?.[0]) fail('TARGET_REQUIRED', `${card.name} requires a Character target.`);
      const target = state.instances[action.targets[0]];
      if (!target?.battlefield || target.controllerId !== player.id) fail('ILLEGAL_TARGET', 'Choose a Character you control.');
    }
    if (program.kind === 'theurgy-charge') {
      if (!controlsDifferentNamedSubtypes(state, player.id, 'Persona User', 'Persona User', cardIndex)) fail('REQUIREMENT_FAILED', 'Control Persona Users with two different names.');
      const discardId = action.activationCostInstanceId;
      if (!discardId || discardId === instance.instanceId || !player.zones.hand.includes(discardId)) fail('ACTIVATION_COST_REQUIRED', 'Put one other card from your hand on the bottom of your Main Deck as the activation cost.');
      player.zones.hand = player.zones.hand.filter((id) => id !== discardId);
      state.instances[discardId].zone = 'mainDeck';
      player.zones.mainDeck.push(discardId);
      addLog(state, { type: 'ACTIVATION_COST_PAID', playerId: player.id, sourceCardId: card.id, cost: 'hand-to-main-deck-bottom', instanceId: discardId });
    }
    for (const key of ['momentum', 'light', 'darkness']) if (player.resources[key] < (card.cost?.[key] ?? 0)) fail('INSUFFICIENT_RESOURCE', `Not enough ${key}.`);
    for (const key of ['momentum', 'light', 'darkness']) player.resources[key] -= card.cost?.[key] ?? 0;
    player.turn.nameLimits[card.name] = true;
    player.zones.hand.splice(player.zones.hand.indexOf(instance.instanceId), 1); instance.zone = 'pending';
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'CARD_EFFECT', playerId: player.id, instanceId: instance.instanceId, cardId: card.id, targets: action.targets ?? [], resourceChoice: action.resourceChoice, requirementInstanceIds, bladeInstanceId: action.bladeInstanceId });
    return state;
  }
  if (action.type === 'DECLARE_ATTACK') {
    if (state.phase !== 'battle') fail('WRONG_PHASE', 'Ordinary attacks are declared in your Battle Phase.');
    if (state.turnNumber === 1 && state.activePlayerId === state.playerOrder[0]) fail('FIRST_TURN_ATTACK', 'The first player cannot declare attacks during their first turn.');
    const attacker = state.instances[action.attackerInstanceId], target = state.instances[action.targetInstanceId];
    if (!attacker?.battlefield || attacker.controllerId !== player.id || !target?.battlefield || target.controllerId === player.id) fail('ILLEGAL_ATTACK', 'Choose your Character as attacker and an opposing Character as target.');
    if (attacker.usage.attackedThisTurn) fail('ATTACK_USED', 'This Character has already attacked this turn.');
    if (attacker.instanceId === player.center && player.turn.freeMainAttackUsed) fail('ATTACK_ALLOWANCE_USED', 'Your Main Character’s free attack allowance was already used.');
    if (attacker.instanceId !== player.center && player.turn.freePartyAttackUsed) fail('ATTACK_ALLOWANCE_USED', 'Your Party Member free attack allowance was already used.');
    const extra = action.chainInstanceIds ?? [];
    if (extra.includes(attacker.instanceId) || new Set(extra).size !== extra.length) fail('INVALID_CHAIN', 'Chain participants must be distinct.');
    const extras = extra.map((id) => state.instances[id]);
    if (extras.some((x) => !x?.battlefield || x.controllerId !== player.id || x.usage.attackedThisTurn)) fail('INVALID_CHAIN', 'Each extra attacker must be an unused allied Character.');
    const extraCost = 2 * extras.length;
    if (player.resources.momentum < extraCost) fail('INSUFFICIENT_RESOURCE', 'Pay 2 Momentum for each additional attacker before responses.');
    player.resources.momentum -= extraCost;
    state.combat = { initiatorId: player.id, defenderId: target.controllerId, attackerIds: [attacker.instanceId, ...extra], targetId: target.instanceId, guardIds: [], guardsDeclared: false, guardWindow: true, declaredAtTurn: state.turnNumber };
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'COMBAT', combat: clone(state.combat) });
    state.menu.priorityPlayerId = state.combat.defenderId;
    state.priorityPlayerId = state.combat.defenderId;
    return state;
  }
  if (action.type === 'ACTIVATE_SPEED') {
    const instance = state.instances[action.instanceId], card = instance && cardIndex.get(instance.cardId);
    if (!instance || instance.zone !== 'hand' || card?.type !== 'Speed Ability') fail('ILLEGAL_SPEED', 'Choose a Speed Ability card from your hand.');
    const program = getEffectProgram(card.id);
    if (!program || program.timing !== 'main') fail('WRONG_TIMING', `${card.name} has no legal current Main Phase activation window.`);
    if (player.turn.nameLimits[card.name]) fail('NAME_LIMIT', `${card.name} is limited to one activation per turn.`);
    for (const key of ['momentum', 'light', 'darkness']) if (player.resources[key] < (card.cost?.[key] ?? 0)) fail('INSUFFICIENT_RESOURCE', `Not enough ${key}.`);
    for (const key of ['momentum', 'light', 'darkness']) player.resources[key] -= card.cost?.[key] ?? 0;
    player.resources.momentum += 1;
    player.turn.nameLimits[card.name] = true;
    player.zones.hand.splice(player.zones.hand.indexOf(instance.instanceId), 1); instance.zone = 'pending';
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'CARD_EFFECT', playerId: player.id, instanceId: instance.instanceId, cardId: card.id, targets: action.targets ?? [] });
    return state;
  }
  fail('ACTION_UNSUPPORTED', `Action ${action.type} is not implemented in the current engine slice.`);
}

function requirementsMet(equipment, hostInstance, cardIndex) {
  const host = cardIndex.get(hostInstance.cardId);
  const tags = new Set([...(host?.subtypes ?? []), ...(host?.combat_subtypes ?? []), ...(host?.franchise_subtypes ?? []), ...(host?.species_nature ?? [])]);
  const req = equipment.requirements ?? { all: [], any: [] };
  return (req.all ?? []).every((tag) => tags.has(tag)) && (req.any ?? []).every((group) => (Array.isArray(group) ? group.some((tag) => tags.has(tag)) : tags.has(group)));
}

export function getLegalActions(state, playerId, cards) {
  const cardIndex = indexCards(cards);
  const player = state.players[playerId];
  if (!player || state.status === 'finished') return [];
  if (state.phase === 'mulligan') return state.mulliganOrder[state.mulliganIndex] === playerId ? [{ type: 'MULLIGAN', max: 5 }] : [];
  if (state.resolutionChoice) {
    if (state.resolutionChoice.playerId !== playerId) return [];
    if (state.resolutionChoice.kind === 'STOCKED_MEMORIES') {
      const choice = state.resolutionChoice;
      const actions = choice.options.map((instanceId) => ({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, stage: choice.stage, instanceId }));
      if (choice.stage === 'ADD_ABILITY' && choice.canDecline) actions.push({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, stage: choice.stage, decline: true });
      return actions;
    }
    return state.resolutionChoice.options.map((instanceId) => ({ type: 'RESOLVE_CHOICE', choiceId: state.resolutionChoice.id, instanceId }));
  }
  if (state.pendingMenuResolution) return [];
  if (state.menu) {
    if (state.menu.priorityPlayerId !== playerId) return [];
    if (state.combat?.guardWindow) {
      const actions = [{ type: 'BEGIN_COMBAT_RESPONSES' }];
      const eligible = player.party.filter(Boolean).filter((id) => !state.combat.attackerIds.includes(id));
      const maxCount = Math.min(eligible.length, Math.floor(player.resources.momentum / 2));
      if (!state.combat.guardsDeclared && maxCount > 0) actions.unshift({ type: 'ASSIGN_GUARDS', eligibleInstanceIds: eligible, costEach: 2, maxCount });
      return actions;
    }
    const actions = [{ type: 'PASS' }];
    for (const id of player.zones.hand) {
      const card = cardIndex.get(state.instances[id].cardId), program = card && getEffectProgram(card.id);
      if (card?.type !== 'Speed Ability' || !program || player.turn.nameLimits[card.name]) continue;
      if (program.timing === 'opponent-attack-response' && state.combat?.initiatorId !== playerId) {
        const defenders = [state.combat.targetId, ...state.combat.guardIds].map((targetId) => state.instances[targetId]).filter((target) => target?.battlefield && target.controllerId === playerId);
        if (program.kind === 'heal') {
          const target = state.instances[state.combat.targetId];
          if (target?.controllerId === playerId && target.battlefield.currentHp < target.battlefield.maxHp / 2 && (program.requires ?? []).every((tag) => hasControlledSubtype(state, playerId, tag, cardIndex))) actions.push({ type: 'ACTIVATE_SPEED', instanceId: id, targets: [target.instanceId] });
        } else if (program.kind === 'curaga-response') {
          const healers = defenders.filter((target) => (cardIndex.get(target.cardId)?.subtypes ?? []).includes('Healer'));
          for (const healer of healers) for (const other of defenders) if (healer.instanceId !== other.instanceId) actions.push({ type: 'ACTIVATE_SPEED', instanceId: id, targets: [healer.instanceId, other.instanceId] });
        }
      }
      if (program.kind === 'soul-sever') {
        for (const pending of state.menu.selects) {
          if (pending.kind !== 'CARD_EFFECT' || pending.playerId === playerId) continue;
          const healingProgram = getEffectProgram(pending.cardId);
          if (healingProgram?.kind !== 'heal' && healingProgram?.kind !== 'curaga-response') continue;
          for (const targetId of pending.targets ?? []) actions.push({ type: 'ACTIVATE_SPEED', instanceId: id, targets: [targetId], responseToSelectId: pending.id });
        }
      }
    }
    return actions;
  }
  if (state.priorityPlayerId !== playerId) return [];
  if (state.activePlayerId !== playerId) return [{ type: 'PASS_PRIORITY' }];
  const actions = [{ type: 'PASS_PRIORITY' }];
  if (state.phase === 'main') {
    if (!player.turn.standardAddUsed && emptyPartyIndex(player) >= 0) for (const id of player.zones.hand) if (cardIndex.get(state.instances[id].cardId)?.type === 'Character' && !cardIndex.get(state.instances[id].cardId).transformation) actions.push({ type: 'ADD_TO_PARTY', instanceId: id });
    if (!player.turn.freeCenterSwitchUsed && !cardIndex.get(state.instances[player.center].cardId)?.transformation) for (const id of player.party.filter(Boolean)) if (!cardIndex.get(state.instances[id].cardId)?.transformation) actions.push({ type: 'SWITCH_CENTER', partyInstanceId: id });
    if (player.resources.momentum >= 6) {
      const swapTargets = player.party.filter(Boolean).filter((id) => !cardIndex.get(state.instances[id].cardId)?.transformation);
      for (let i = 0; i < swapTargets.length; i += 1) {
        actions.push({ type: 'PARTY_SWAP', instanceIds: [swapTargets[i]] });
        for (let j = i + 1; j < swapTargets.length; j += 1) actions.push({ type: 'PARTY_SWAP', instanceIds: [swapTargets[i], swapTargets[j]] });
      }
    }
    for (const id of player.zones.arsenal) {
      const equipment = cardIndex.get(state.instances[id].cardId), cost = equipment?.cost ?? {};
      if (player.resources.light < (cost.light ?? 0) || player.resources.darkness < (cost.darkness ?? 0)) continue;
      for (const hostId of [player.center, ...player.party].filter(Boolean)) if (!player.turn.equipmentLockedInstanceIds.includes(hostId) && requirementsMet(equipment ?? {}, state.instances[hostId], cardIndex)) actions.push({ type: 'ATTACH_EQUIPMENT', equipmentInstanceId: id, hostInstanceId: hostId });
    }
    for (const id of player.zones.hand) {
      const card = cardIndex.get(state.instances[id].cardId), program = card && getEffectProgram(card.id);
      if (card?.type === 'Ability' && program?.timing === 'main' && !player.turn.nameLimits[card.name]) {
        if (program.kind === 'aether-channel' && controlsDifferentNamedSubtypes(state, playerId, 'Mage', 'Warrior', cardIndex)) {
          const field = [player.center, ...player.party].filter(Boolean).map((characterId) => state.instances[characterId]);
          const mages = field.filter((x) => (cardIndex.get(x.cardId)?.subtypes ?? []).includes('Mage'));
          const warriors = field.filter((x) => (cardIndex.get(x.cardId)?.subtypes ?? []).includes('Warrior'));
          for (const mage of mages) for (const warrior of warriors) {
            if (cardIndex.get(mage.cardId)?.name === cardIndex.get(warrior.cardId)?.name) continue;
            for (const resourceChoice of program.resourceChoices) actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, resourceChoice, requirementInstanceIds: [mage.instanceId, warrior.instanceId] });
          }
        } else if (program.kind === 'theurgy-charge') {
          if (controlsDifferentNamedSubtypes(state, playerId, 'Persona User', 'Persona User', cardIndex)) for (const costId of player.zones.hand) if (costId !== id) actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, activationCostInstanceId: costId });
        } else if (program.kind === 'armiger-preparation') {
          if (armigerRequirementMet(state, playerId, cardIndex, program.minimumAttachedEquipment)) actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, abilityKind: program.kind });
        } else if (program.kind === 'stocked-memories') {
          actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, abilityKind: program.kind });
        } else if (program.kind === 'blade-awakening') {
          if (hasControlledSubtype(state, playerId, 'Driver', cardIndex) && !hasControlledSubtype(state, playerId, 'Blade', cardIndex) && emptyPartyIndex(player) >= 0) {
            const blades = player.zones.hand.filter((handId) => { const c = cardIndex.get(state.instances[handId].cardId); return c?.type === 'Character' && !c.transformation && (c.subtypes ?? []).includes('Blade'); });
            const discards = player.zones.hand.filter((handId) => handId !== id && cardIndex.get(state.instances[handId].cardId)?.type === 'Ability');
            for (const bladeInstanceId of blades) for (const activationCostInstanceId of discards) if (bladeInstanceId !== activationCostInstanceId) actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, bladeInstanceId, activationCostInstanceId });
          }
        } else actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, targetOptions: [player.center, ...player.party].filter(Boolean) });
      }
      if (card?.type === 'Speed Ability' && program?.timing === 'main' && !player.turn.nameLimits[card.name]) actions.push({ type: 'ACTIVATE_SPEED', instanceId: id });
    }
    for (const formId of player.zones.arsenal) {
      const form = cardIndex.get(state.instances[formId]?.cardId);
      if (form?.transformation && supportedTransformationIds().includes(form.id)) {
        const cost = form.cost ?? {};
        if (['momentum', 'light', 'darkness'].some((key) => player.resources[key] < (cost[key] ?? 0))) continue;
        for (const baseId of [player.center, ...player.party].filter(Boolean)) {
          const base = state.instances[baseId];
          if (base.cardId !== form.transformation.base_id || !transformationRequirementMet(state, form, base, player, cardIndex)) continue;
          if (baseId === player.center && ![...player.zones.hand, ...player.zones.mainDeck, ...player.zones.continue].some((id) => state.instances[id]?.cardId === base.cardId)) continue;
          actions.push({ type: 'TRANSFORM', formInstanceId: formId, baseInstanceId: baseId, reserveRequired: baseId === player.center });
        }
      }
    }
  }
  if (state.phase === 'battle' && !(state.turnNumber === 1 && state.activePlayerId === state.playerOrder[0])) {
    const enemies = state.playerOrder.filter((id) => id !== playerId).flatMap((id) => [state.players[id].center, ...state.players[id].party].filter(Boolean));
    const attackers = [];
    if (!player.turn.freeMainAttackUsed && !state.instances[player.center].usage.attackedThisTurn) attackers.push(player.center);
    if (!player.turn.freePartyAttackUsed) attackers.push(...player.party.filter((id) => id && !state.instances[id].usage.attackedThisTurn));
    for (const attackerInstanceId of attackers) for (const targetInstanceId of enemies) {
      actions.push({ type: 'DECLARE_ATTACK', attackerInstanceId, targetInstanceId, availableChainIds: [player.center, ...player.party].filter((id) => id && id !== attackerInstanceId && !state.instances[id].usage.attackedThisTurn && player.resources.momentum >= 2) });
    }
  }
  return actions;
}

export function assertStateInvariants(state, cards) {
  const cardIndex = indexCards(cards), seen = new Set();
  if (!state.players[state.priorityPlayerId]) fail('PRIORITY_INVARIANT', 'Priority must belong to a registered player.');
  if (!Number.isInteger(state.phasePasses) || state.phasePasses < 0 || state.phasePasses > 1 || (state.menu && state.phasePasses !== 0)) fail('PHASE_PRIORITY_INVARIANT', 'Empty-window pass state is invalid or overlaps an open Menu.');
  if (state.menu && !state.players[state.menu.priorityPlayerId]) fail('MENU_PRIORITY_INVARIANT', 'Menu priority must belong to a registered player.');
  if (state.resolutionChoice && (state.menu || !state.pendingMenuResolution || !state.players[state.resolutionChoice.playerId])) fail('RESOLUTION_CHOICE_INVARIANT', 'A resolution choice must pause a Menu resolution without opening a response window.');
  if (state.pendingMenuResolution && !state.resolutionChoice) fail('MENU_RESOLUTION_INVARIANT', 'Paused Menu resolution must have a pending choice.');
  if (!Array.isArray(state.pendingTriggers) || state.pendingTriggers.some((group) => !group.id || !Array.isArray(group.records) || group.records.some((record) => !state.players[record.controllerId] || !record.eventSnapshot || !record.sourceSnapshot))) fail('TRIGGER_QUEUE_INVARIANT', 'Pending trigger groups must retain their event and source snapshots.');
  for (const player of Object.values(state.players)) {
    const allZones = [...player.zones.mainDeck, ...player.zones.hand, ...player.zones.continue, ...(player.zones.revealed ?? []), ...player.zones.arsenal, ...player.zones.baseReserve, player.center, ...player.party].filter(Boolean);
    for (const id of allZones) { if (seen.has(id)) fail('ZONE_DUPLICATION', `${id} appears in more than one zone.`); seen.add(id); }
    for (const id of allZones) if (!state.instances[id]) fail('UNKNOWN_INSTANCE', `${id} has no card instance record.`);
    const center = player.center && state.instances[player.center];
    if (!center?.battlefield || center.battlefield.position !== 'center' || center.controllerId !== player.id) fail('CENTER_INVARIANT', `${player.id} must control one Character in Center.`);
    for (const id of player.party.filter(Boolean)) { const c=state.instances[id]; if(!c?.battlefield||c.battlefield.position==='center'||c.controllerId!==player.id) fail('PARTY_INVARIANT',`${id} is not a controlled Party Member.`); }
  }
  for (const instance of Object.values(state.instances)) if (instance.zone === 'attached' && (!instance.attachedTo || !state.instances[instance.attachedTo]?.battlefield)) fail('ATTACHMENT_INVARIANT', `${instance.instanceId} has no legal host.`);
  if (seen.size !== Object.values(state.instances).filter((instance) => !['pending', 'attached', 'underlay', 'retired'].includes(instance.zone)).length) fail('ZONE_CONSERVATION', 'A card instance is missing from its owner’s public or private zones.');
  const livePhysicalCopies = Object.values(state.instances).filter((instance) => !['pending', 'attached', 'underlay', 'retired'].includes(instance.zone));
  if (new Set(livePhysicalCopies.map((instance) => instance.physicalCopyId)).size !== livePhysicalCopies.length) fail('PHYSICAL_COPY_DUPLICATION', 'A registered physical card copy has more than one active battlefield/zone instance.');
  return true;
}
