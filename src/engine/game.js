Warning: truncated output (original token count: 31955)
Total output lines: 1697

import { getEffectProgram, getEquipmentProgram, getSpecialProgram, getTriggerProgram } from './effects.js';
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
  if (!mainIds.some((id) => { const card = cardIndex.get(id); return card?.type === 'Character' && !card.transformation; })) errors.push('Main Deck must contain at least one nontransformed Character for starting Main selection.');
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
export function createInitialState({ players, chooserId, seed = 1, cards, sandboxMode = false }) {
  const cardIndex = indexCards(cards);
  if (!Array.isArray(players) || players.length !== 2) fail('PLAYER_COUNT', 'This rules edition requires exactly two players.');
  const ids = players.map((p) => p.id);
  if (new Set(ids).size !== 2 || ids.some((id) => !id)) fail('PLAYER_IDS', 'Players must have distinct nonempty IDs.');
  if (!ids.includes(chooserId)) fail('FIRST_PLAYER', 'The first-player chooser must be a registered player.');
  const instances = {};
  const pstate = {};
  let nextInstance = 1;
  for (const player of players) {
    const registration = validateRegistration(player.deck, cardIndex);
    if (!registration.valid) fail('ILLEGAL_DECK', `${player.name ?? player.id}: ${registration.errors.join(' ')}`);
    const owned = (cardId, zone) => {
      const id = `${player.id}-C${String(nextInstance++).padStart(4, '0')}`;
      instances[id] = createInstance({ id, cardId, ownerId: player.id, zone });
      return id;
    };
    const mainDeck = player.deck.mainIds.map((cardId) => owned(cardId, 'mainDeck'));
    const arsenal = player.deck.equipmentIds.map((cardId) => owned(cardId, 'arsenal'));
    pstate[player.id] = {
      id: player.id,
      name: player.name ?? player.id,
      life: 15,
      resources: { momentum: 5, light: 0, darkness: 0 },
      zones: { mainDeck, hand: [], continue: [], revealed: [], arsenal, baseReserve: [] },
      center: null,
      party: Array(6).fill(null),
      registration: { mainCount: player.deck.mainIds.length, equipmentIds: [...player.deck.equipmentIds] },
      turn: { standardAddUsed: false, freeCenterSwitchUsed: false, freeMainAttackUsed: false, freePartyAttackUsed: false, finisherCombatUsed: false, finisherDisabled: false, equipmentLockedInstanceIds: [], suppressNextEquipmentAbilities: false, nextAbilityMomentumDiscount: null, nameLimits: {} }
    };
  }
  return {
    schemaVersion: 1,
    status: 'setup',
    sandboxMode: sandboxMode === true,
    players: pstate,
    playerOrder: [...ids],
    activePlayerId: chooserId,
    firstPlayerChooserId: chooserId,
    turnNumber: 1,
    phase: 'first-player-choice',
    priorityPlayerId: chooserId,
    phasePasses: 0,
    mulliganOrder: [],
    mulliganIndex: 0,
    startingMainOrder: [],
    startingMainIndex: 0,
    instances,
    nextInstanceNumber: nextInstance,
    menu: null,
    pendingTriggers: [],
    nextTriggerGroupNumber: 1,
    nextEventNumber: 1,
    pendingMenuResolution: null,
    resolutionChoice: null,
    combat: null,
    log: [{ type: 'GAME_CREATED', playerIds: ids, chooserId }],
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
    player.turn.nextAbilityMomentumDiscount = null;
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

function beginDeckRevealChoice(state, select, program, cardIndex) {
  const player = state.players[select.playerId];
  const revealedInstanceIds = player.zones.mainDeck.splice(0, program.revealCount);
  for (const instanceId of revealedInstanceIds) {
    state.instances[instanceId].zone = 'revealed';
    player.zones.revealed.push(instanceId);
  }
  const options = revealedInstanceIds.filter((id) => {
    const card = cardIndex.get(state.instances[id].cardId);
    return card?.type === program.addType
      && (!program.excludeTransformations || !card.transformation)
      && (!program.addSubtype || (card.subtypes ?? []).includes(program.addSubtype))
      && (!program.addAnySubtype || program.addAnySubtype.some((subtype) => (card.subtypes ?? []).includes(subtype)));
  });
  const addStage = program.addTo === 'party' ? 'ADD_PARTY' : 'ADD_ABILITY';
  state.resolutionChoice = {
    id: `RC${state.log.length + 1}`, kind: 'DECK_REVEAL', effectKind: program.kind, stage: addStage, playerId: player.id,
    sourceCardId: select.cardId, revealedInstanceIds: [...revealedInstanceIds], remainingRevealedIds: [...revealedInstanceIds],
    options, canDecline: true, prompt: 'Choose an Ability among the revealed cards to add to hand, or skip that optional instruction.'
  };
  if (program.addTo === 'party') state.resolutionChoice.prompt = 'Choose a revealed untransformed Sword Wielder to Add to an empty Party Zone, or skip that optional instruction.';
  if (program.kind === 'dorm-study-session') state.resolutionChoice.prompt = 'Choose a revealed untransformed Support or Healer to Add to an empty Party Zone, or skip that optional instruction.';
  addLog(state, { type: 'CARDS_REVEALED', playerId: player.id, sourceCardId: select.cardId, instanceIds: revealedInstanceIds, cardIds: revealedInstanceIds.map((id) => state.instances[id].cardId) });
}

function setDeckBottomOrderChoice(state, choice, cardIndex) {
  if (choice.remainingRevealedIds.length) {
    choice.stage = 'BOTTOM_REVEALED';
    choice.options = [...choice.remainingRevealedIds];
    choice.canDecline = false;
    choice.prompt = 'Choose the next revealed card to place on the bottom of your Main Deck.';
    return false;
  }
  if (choice.effectKind === 'grace-intel') {
    if (choice.grantResourceIfAdded) {
      choice.stage = 'GRACE_RESOURCE';
      choice.options = ['light', 'darkness'];
      choice.canDecline = false;
      choice.prompt = 'Choose one Light or Darkness to gain for revealing a required Healer or Support Ability.';
      return false;
    }
    return beginGraceAllyChoice(state, choice, cardIndex);
  }
  state.resolutionChoice = null;
  return true;
}

function beginGraceAllyChoice(state, choice, cardIndex) {
  const player = state.players[choice.playerId];
  const sourceFranchise = cardIndex.get(choice.sourceCardId)?.franchise;
  const eligible = [player.center, ...player.party].filter(Boolean).flatMap((instanceId) => {
    const instance = state.instances[instanceId], card = instance && cardIndex.get(instance.cardId);
    if (!card || card.franchise === sourceFranchise) return [];
    return (card.combat_subtypes ?? []).map((subtype) => ({ instanceId, subtype }));
  });
  if (!eligible.length) {
    state.resolutionChoice = null;
    addLog(state, { type: 'CHARACTER_SPECIAL_RESOLVED', sourceInstanceId: choice.sourceInstanceId, cardId: choice.sourceCardId, discountSet: false, reason: 'No allied Character from another franchise has a universal combat subtype.' });
    return true;
  }
  choice.stage = 'GRACE_ALLY';
  choice.options = eligible;
  choice.canDecline = false;
  choice.prompt = 'Choose an allied Character from another franchise and one of its printed universal combat subtypes.';
  return false;
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
      if (instance && program?.kind === 'effect-damage') {
        const targetId = select.targets?.[0];
        const target = state.instances[targetId];
        if (target?.battlefield && target.controllerId !== select.playerId) {
          let amount = program.amount;
          const bonus = program.bonus;
          if (bonus && hasControlledSubtype(state, select.playerId, bonus.requiresControllerSubtype, cardIndex)
            && attachedEquipment(state, targetId).length >= bonus.targetEquipmentAtLeast) amount += bonus.amount;
          resolveDamageTransaction(state, cardIndex, [{ targetId, amount }], { origin: 'effect', sourcePlayerId: select.playerId, sourceCardId: card.id });
        } else addLog(state, { type: 'EFFECT_FIZZLED', selectId: select.id, sourceCardId: card.id, reason: 'The chosen opposing Character was no longer a legal target.' });
      }
      if (instance && program?.kind === 'heart-to-heart') {
        const targets = (select.targets ?? []).map((id) => state.instances[id]);
        if (targets.length === 2 && targets.every((target) => target?.battlefield && target.controllerId === select.playerId)) {
          const [first, second] = targets;
          const firstCard = cardIndex.get(first.cardId), secondCard = cardIndex.get(second.cardId);
          if (firstCard?.franchise !== secondCard?.franchise) {
            const firstInjured = first.battlefield.currentHp < first.battlefield.maxHp;
            const secondInjured = second.battlefield.currentHp < second.battlefield.maxHp;
            if (firstInjured && secondInjured) {
              for (const target of targets) {
                const amount = Math.min(program.bothInjuredHeal, target.battlefield.maxHp - target.battlefield.currentHp);
                target.battlefield.currentHp += amount;
                addLog(state, { type: 'HP_RESTORED', playerId: select.playerId, sourceCardId: card.id, targetId: target.instanceId, amount });
              }
            } else {
              const injured = firstInjured ? first : secondInjured ? second : null;
              if (injured) {
                const amount = Math.min(program.oneInjuredHeal, injured.battlefield.maxHp - injured.battlefield.currentHp);
                injured.battlefield.currentHp += amount;
                addLog(state, { type: 'HP_RESTORED', playerId: select.playerId, sourceCardId: card.id, targetId: injured.instanceId, amount });
              }
              state.players[select.playerId].resources.momentum += program.noBothInjuredMomentum;
              addLog(state, { type: 'RESOURCE_GAINED', playerId: select.playerId, sourceCardId: card.id, resource: 'momentum', amount: program.noBothInjuredMomentum });
            }
          } else addLog(state, { type: 'EFFECT_FIZZLED', selectId: select.id, sourceCardId: card.id, reason: 'The chosen Characters no longer represent different franchises.' });
        } else addLog(state, { type: 'EFFECT_FIZZLED', selectId: select.id, sourceCardId: card.id, reason: 'Both chosen allied Characters must remain in Character Zones.' });
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
      if (instance && ['stocked-memories', 'union-cross', 'dorm-study-session'].includes(program?.kind)) beginDeckRevealChoice(state, select, program, cardIndex);
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
      if (state.resolutionChoice?.kind === 'DECK_REVEAL') {
        state.pendingMenuResolution = { menuId, remainingSelections: selections.slice(index + 1), originalSelectCount };
        state.priorityPlayerId = state.resolutionChoice.playerId;
        return;
      }
    } else if (select.kind === 'COMBAT') {
      resolveCombat(state, cardIndex);
    } else if (select.kind === 'CHARACTER_SPECIAL') {
      const source = state.instances[select.instanceId];
      const sourceCard = source && cardIndex.get(source.cardId);
      const program = getSpecialProgram(select.cardId);
      if (source?.cardId === select.cardId && program?.kind === 'axel-party-blast') {
        const targets = (select.targets ?? []).map((id) => state.instances[id]).filter((target) => target?.battlefield
          && target.controllerId !== select.playerId && state.players[target.controllerId].party.includes(target.instanceId));
        if (targets.length) resolveDamageTransaction(state, cardIndex, targets.map((target) => ({ targetId: target.instanceId, amount: program.amount })), { origin: 'effect', sourcePlayerId: select.playerId, sourceCardId: sourceCard.id });
        addLog(state, { type: 'CHARACTER_SPECIAL_RESOLVED', selectId: select.id, sourceInstanceId: source.instanceId, cardId: sourceCard.id, affectedTargets: targets.map((target) => target.instanceId) });
      } else if (source?.cardId === select.cardId && program?.kind === 'ashley-rescue') {
        const target = state.instances[select.targets?.[0]];
        const targetCard = target && cardIndex.get(target.cardId);
        const player = state.players[select.playerId];
        const partyIndex = player.party.indexOf(target?.instanceId);
        if (target?.battlefield && target.controllerId === player.id && partyIndex >= 0 && !targetCard?.transformation
          && target.battlefield.maxHp - target.battlefield.currentHp >= program.minimumMissingHp) {
          const lastKnown = snapshotCharacter(state, target, cardIndex);
          for (const eventType of ['character-left-battlefield', 'character-returned-to-hand']) {
            collectEventTriggers(state, { id: `E${String(state.nextEventNumber++).padStart(4, '0')}`, type: eventType, turn: state.turnNumber, instanceId: target.instanceId, controllerId: target.controllerId }, [lastKnown], cardIndex);
          }
          returnAttachedEquipment(state, target.instanceId);
          player.party[partyIndex] = null;
          target.zone = 'retired'; target.battlefield = null; target.attachedTo = null;
          const returnedId = `${player.id}-C${String(state.nextInstanc…11955 tokens truncated…gth + 1}`, kind: 'SWITCH_CENTER', playerId: player.id, partyInstanceId: incoming.instanceId });
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
    const discount = player.turn.nextAbilityMomentumDiscount;
    const consumesDiscount = card.type === 'Ability' && !!discount && hasPrintedRequirement(card, discount.subtype);
    const momentumDiscount = consumesDiscount ? Math.min(card.cost?.momentum ?? 0, discount.amount) : 0;
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
    } else if (program.kind === 'effect-damage') {
      const target = state.instances[action.targets?.[0]];
      if (!target?.battlefield || target.controllerId === player.id) fail('ILLEGAL_TARGET', 'Choose an opposing Character as the effect-damage target.');
    } else if (program.kind === 'heart-to-heart') {
      const targets = action.targets ?? [];
      const selected = targets.map((id) => state.instances[id]);
      if (targets.length !== program.targetCount || new Set(targets).size !== targets.length
        || selected.some((target) => !target?.battlefield || target.controllerId !== player.id)
        || cardIndex.get(selected[0]?.cardId)?.franchise === cardIndex.get(selected[1]?.cardId)?.franchise) fail('ILLEGAL_TARGET', 'Choose two different allied Characters from different franchises.');
    } else if (program.kind === 'union-cross') {
      if (!controlsDifferentNamedSubtypes(state, player.id, 'Keyblade Wielder', 'Keyblade Wielder', cardIndex)) fail('REQUIREMENT_FAILED', 'Union Cross requires two differently named Keyblade Wielders you control.');
      const costId = action.activationCostInstanceId;
      if (!costId || costId === instance.instanceId || !player.zones.hand.includes(costId)) fail('ACTIVATION_COST_REQUIRED', 'Discard one other card from your hand as Union Cross’s activation cost.');
      player.zones.hand = player.zones.hand.filter((id) => id !== costId);
      state.instances[costId].zone = 'continue';
      player.zones.continue.push(costId);
      addLog(state, { type: 'ACTIVATION_COST_PAID', playerId: player.id, sourceCardId: card.id, cost: 'discard-hand-card', instanceId: costId });
    } else if (program.kind === 'dorm-study-session') {
      if (hasControlledSubtype(state, player.id, program.conditionalActivationCost.ifControlledSubtype, cardIndex)) {
        const costId = action.activationCostInstanceId;
        if (!costId || costId === instance.instanceId || !player.zones.hand.includes(costId)
          || cardIndex.get(state.instances[costId]?.cardId)?.type !== program.conditionalActivationCost.handCardType) {
          fail('ACTIVATION_COST_REQUIRED', 'Because you control a Persona User, discard a Character card from your hand as Dorm Study Session’s activation cost.');
        }
        player.zones.hand = player.zones.hand.filter((id) => id !== costId);
        state.instances[costId].zone = 'continue';
        player.zones.continue.push(costId);
        addLog(state, { type: 'ACTIVATION_COST_PAID', playerId: player.id, sourceCardId: card.id, cost: 'discard-character', instanceId: costId });
      } else if (action.activationCostInstanceId) {
        fail('ILLEGAL_ACTIVATION_COST', 'Dorm Study Session has no discard cost unless you control a Persona User.');
      }
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
    for (const key of ['momentum', 'light', 'darkness']) {
      const cost = Math.max(0, (card.cost?.[key] ?? 0) - (key === 'momentum' ? momentumDiscount : 0));
      if (player.resources[key] < cost) fail('INSUFFICIENT_RESOURCE', `Not enough ${key}.`);
    }
    for (const key of ['momentum', 'light', 'darkness']) player.resources[key] -= Math.max(0, (card.cost?.[key] ?? 0) - (key === 'momentum' ? momentumDiscount : 0));
    if (consumesDiscount) {
      player.turn.nextAbilityMomentumDiscount = null;
      addLog(state, { type: 'ABILITY_MOMENTUM_DISCOUNT_USED', playerId: player.id, sourceCardId: discount.sourceCardId, abilityCardId: card.id, subtype: discount.subtype, amount: momentumDiscount });
    }
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
    if (attacker.cannotAttackUntilTurn != null && state.turnNumber < attacker.cannotAttackUntilTurn) fail('ATTACK_SUPPRESSED', 'This Character cannot attack until its restriction expires.');
    if (attacker.usage.attackedThisTurn) fail('ATTACK_USED', 'This Character has already attacked this turn.');
    if (attacker.instanceId === player.center && player.turn.freeMainAttackUsed) fail('ATTACK_ALLOWANCE_USED', 'Your Main Character’s free attack allowance was already used.');
    if (attacker.instanceId !== player.center && player.turn.freePartyAttackUsed) fail('ATTACK_ALLOWANCE_USED', 'Your Party Member free attack allowance was already used.');
    const extra = action.chainInstanceIds ?? [];
    if (extra.includes(attacker.instanceId) || new Set(extra).size !== extra.length) fail('INVALID_CHAIN', 'Chain participants must be distinct.');
    const extras = extra.map((id) => state.instances[id]);
    if (extras.some((x) => !x?.battlefield || x.controllerId !== player.id || x.usage.attackedThisTurn || (x.cannotAttackUntilTurn != null && state.turnNumber < x.cannotAttackUntilTurn))) fail('INVALID_CHAIN', 'Each extra attacker must be an unused allied Character.');
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

function hasPrintedRequirement(card, subtype) {
  return [...(card?.requirements?.all ?? []), ...(card?.requirements?.any ?? [])].includes(subtype);
}

export function getLegalActions(state, playerId, cards) {
  const cardIndex = indexCards(cards);
  const player = state.players[playerId];
  if (!player || state.status === 'finished') return [];
  if (state.phase === 'first-player-choice') return playerId === state.firstPlayerChooserId
    ? state.playerOrder.map((firstPlayerId) => ({ type: 'CHOOSE_FIRST_PLAYER', firstPlayerId })) : [];
  if (state.phase === 'starting-main-selection') {
    if (playerId !== state.startingMainOrder[state.startingMainIndex]) return [];
    return player.zones.mainDeck.filter((id) => {
      const card = cardIndex.get(state.instances[id]?.cardId);
      return card?.type === 'Character' && !card.transformation;
    }).map((instanceId) => ({ type: 'SELECT_STARTING_MAIN', instanceId }));
  }
  if (state.phase === 'mulligan') return state.mulliganOrder[state.mulliganIndex] === playerId ? [{ type: 'MULLIGAN', max: 5 }] : [];
  if (state.resolutionChoice) {
    if (state.resolutionChoice.playerId !== playerId) return [];
    if (state.resolutionChoice.kind === 'ASHLEY_REPLACEMENT') {
      const choice = state.resolutionChoice;
      const actions = choice.options.map((instanceId) => ({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, instanceId }));
      if (choice.canDecline) actions.push({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, decline: true });
      return actions;
    }
    if (state.resolutionChoice.kind === 'DECK_REVEAL') {
      const choice = state.resolutionChoice;
      if (choice.stage === 'GRACE_RESOURCE') return choice.options.map((resourceChoice) => ({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, stage: choice.stage, resourceChoice }));
      if (choice.stage === 'GRACE_ALLY') return choice.options.map(({ instanceId, subtype }) => ({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, stage: choice.stage, instanceId, subtype }));
      if (choice.stage === 'ADD_PARTY') {
        const emptySlots = player.party.flatMap((instanceId, partyIndex) => instanceId === null ? [partyIndex] : []);
        const actions = choice.options.flatMap((instanceId) => emptySlots.map((partyIndex) => ({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, effectKind: choice.effectKind, stage: choice.stage, instanceId, partyIndex })));
        if (choice.canDecline) actions.push({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, effectKind: choice.effectKind, stage: choice.stage, decline: true });
        return actions;
      }
      const actions = choice.options.map((instanceId) => ({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, stage: choice.stage, instanceId }));
      if (choice.stage === 'ADD_ABILITY' && choice.canDecline) actions.push({ type: 'RESOLVE_CHOICE', choiceId: choice.id, choiceKind: choice.kind, effectKind: choice.effectKind, stage: choice.stage, decline: true });
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
        const discount = player.turn.nextAbilityMomentumDiscount;
        const momentumDiscount = discount && hasPrintedRequirement(card, discount.subtype) ? Math.min(card.cost?.momentum ?? 0, discount.amount) : 0;
        if (['momentum', 'light', 'darkness'].some((resource) => player.resources[resource] < Math.max(0, (card.cost?.[resource] ?? 0) - (resource === 'momentum' ? momentumDiscount : 0)))) continue;
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
        } else if (program.kind === 'union-cross') {
          if (controlsDifferentNamedSubtypes(state, playerId, 'Keyblade Wielder', 'Keyblade Wielder', cardIndex)) {
            for (const activationCostInstanceId of player.zones.hand) if (activationCostInstanceId !== id) actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, abilityKind: program.kind, activationCostInstanceId });
          }
        } else if (program.kind === 'dorm-study-session') {
          if (hasControlledSubtype(state, playerId, program.conditionalActivationCost.ifControlledSubtype, cardIndex)) {
            for (const activationCostInstanceId of player.zones.hand) {
              if (activationCostInstanceId !== id && cardIndex.get(state.instances[activationCostInstanceId]?.cardId)?.type === 'Character') actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, abilityKind: program.kind, activationCostInstanceId });
            }
          } else actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, abilityKind: program.kind });
        } else if (program.kind === 'effect-damage') {
          const targetOptions = state.playerOrder.filter((id) => id !== playerId).flatMap((id) => [state.players[id].center, ...state.players[id].party].filter(Boolean));
          for (const targetId of targetOptions) actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, abilityKind: program.kind, targets: [targetId] });
        } else if (program.kind === 'heart-to-heart') {
          const allies = [player.center, ...player.party].filter(Boolean);
          for (let i = 0; i < allies.length; i += 1) for (let j = i + 1; j < allies.length; j += 1) {
            const first = cardIndex.get(state.instances[allies[i]].cardId), second = cardIndex.get(state.instances[allies[j]].cardId);
            if (first.franchise !== second.franchise) actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, abilityKind: program.kind, targets: [allies[i], allies[j]] });
          }
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
    for (const instanceId of [player.center, ...player.party].filter(Boolean)) {
      const character = state.instances[instanceId], program = character && getSpecialProgram(character.cardId);
      if (!program || program.timing !== 'main' || player.turn.nameLimits[cardIndex.get(character.cardId)?.name]
        || (character.characterSpecialsSuppressedUntilTurn ?? 0) > state.turnNumber) continue;
      if (program.kind === 'axel-party-blast') {
        const enemies = state.playerOrder.filter((id) => id !== playerId).flatMap((id) => state.players[id].party.filter(Boolean));
        const targetSets = [[]];
        for (const enemy of enemies) targetSets.push([enemy]);
        if (program.targetCount.max > 1) for (let i = 0; i < enemies.length; i += 1) for (let j = i + 1; j < enemies.length; j += 1) targetSets.push([enemies[i], enemies[j]]);
        const costs = player.zones.hand.filter((handId) => handId !== instanceId);
        for (const activationCostInstanceId of costs) for (const targets of targetSets) actions.push({ type: 'ACTIVATE_SPECIAL', instanceId, activationCostInstanceId, targets });
      } else if (program.kind === 'ashley-rescue') {
        for (const targetId of player.party.filter(Boolean)) {
          const target = state.instances[targetId];
          if (targetId !== instanceId && !cardIndex.get(target.cardId)?.transformation && target.battlefield.maxHp - target.battlefield.currentHp >= program.minimumMissingHp) actions.push({ type: 'ACTIVATE_SPECIAL', instanceId, targets: [targetId] });
        }
      } else if (program.kind === 'grace-intel') actions.push({ type: 'ACTIVATE_SPECIAL', instanceId, targets: [] });
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
    if (!player.turn.freeMainAttackUsed && !state.instances[player.center].usage.attackedThisTurn && !(state.instances[player.center].cannotAttackUntilTurn != null && state.turnNumber < state.instances[player.center].cannotAttackUntilTurn)) attackers.push(player.center);
    if (!player.turn.freePartyAttackUsed) attackers.push(...player.party.filter((id) => id && !state.instances[id].usage.attackedThisTurn && !(state.instances[id].cannotAttackUntilTurn != null && state.turnNumber < state.instances[id].cannotAttackUntilTurn)));
    for (const attackerInstanceId of attackers) for (const targetInstanceId of enemies) {
      actions.push({ type: 'DECLARE_ATTACK', attackerInstanceId, targetInstanceId, availableChainIds: [player.center, ...player.party].filter((id) => id && id !== attackerInstanceId && !state.instances[id].usage.attackedThisTurn && !(state.instances[id].cannotAttackUntilTurn != null && state.turnNumber < state.instances[id].cannotAttackUntilTurn) && player.resources.momentum >= 2) });
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
    const setupAllowsMissingCenter = ['first-player-choice', 'starting-main-selection'].includes(state.phase);
    if (!center && !setupAllowsMissingCenter) fail('CENTER_INVARIANT', `${player.id} must control one Character in Center.`);
    if (center && (!center.battlefield || center.battlefield.position !== 'center' || center.controllerId !== player.id)) fail('CENTER_INVARIANT', `${player.id} must control one Character in Center.`);
    for (const id of player.party.filter(Boolean)) { const c=state.instances[id]; if(!c?.battlefield||c.battlefield.position==='center'||c.controllerId!==player.id) fail('PARTY_INVARIANT',`${id} is not a controlled Party Member.`); }
  }
  for (const instance of Object.values(state.instances)) if (instance.zone === 'attached' && (!instance.attachedTo || !state.instances[instance.attachedTo]?.battlefield)) fail('ATTACHMENT_INVARIANT', `${instance.instanceId} has no legal host.`);
  if (seen.size !== Object.values(state.instances).filter((instance) => !['pending', 'attached', 'underlay', 'retired'].includes(instance.zone)).length) fail('ZONE_CONSERVATION', 'A card instance is missing from its owner’s public or private zones.');
  const livePhysicalCopies = Object.values(state.instances).filter((instance) => !['pending', 'attached', 'underlay', 'retired'].includes(instance.zone));
  if (new Set(livePhysicalCopies.map((instance) => instance.physicalCopyId)).size !== livePhysicalCopies.length) fail('PHYSICAL_COPY_DUPLICATION', 'A registered physical card copy has more than one active battlefield/zone instance.');
  return true;
}

