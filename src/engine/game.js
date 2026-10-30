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
  if (equipmentIds.length !== 20) errors.push('Equipment/Transformation Deck must occupy exactly 20 slots.');
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

function createInstance({ id, cardId, ownerId, zone }) {
  return { instanceId: id, cardId, ownerId, controllerId: ownerId, zone, attachedTo: null, battlefield: null, usage: { attackedThisTurn: false, nameLimits: {} } };
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
      zones: { mainDeck, hand, continue: [], arsenal, baseReserve: [] },
      center: starter,
      party: Array(6).fill(null),
      registration: { mainCount: player.deck.mainIds.length, equipmentIds: [...player.deck.equipmentIds] },
      turn: { standardAddUsed: false, freeCenterSwitchUsed: false, freeMainAttackUsed: false, freePartyAttackUsed: false, finisherCombatUsed: false, nameLimits: {} }
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
    mulliganOrder: [firstPlayerId, opponentId],
    mulliganIndex: 0,
    instances,
    menu: null,
    pendingTriggers: [],
    combat: null,
    log: [{ type: 'GAME_CREATED', playerIds: ids, firstPlayerId, chooserId }],
    randomSeed: seed >>> 0
  };
}

function addLog(state, event) { state.log.push({ ...event, turn: state.turnNumber, phase: state.phase }); }
function currentPlayer(state) { return state.players[state.activePlayerId]; }
function emptyPartyIndex(player) { return player.party.findIndex((id) => id === null); }

function startNextTurn(state, cardIndex) {
  state.turnNumber += 1;
  state.activePlayerId = state.playerOrder[(state.playerOrder.indexOf(state.activePlayerId) + 1) % 2];
  for (const player of Object.values(state.players)) {
    player.turn.standardAddUsed = false;
    player.turn.freeCenterSwitchUsed = false;
    player.turn.freeMainAttackUsed = false;
    player.turn.freePartyAttackUsed = false;
    player.turn.finisherCombatUsed = false;
    player.turn.nameLimits = {};
    for (const instance of Object.values(state.instances)) instance.usage.nameLimits = {};
  }
  const player = currentPlayer(state);
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
  state.menu = null;
  state.combat = null;
  addLog(state, { type: 'TURN_STARTED', playerId: player.id, drew: drawn, resources: { ...player.resources }, cardIndexSize: cardIndex.size });
}

function openMenu(state, initiatorId, select) {
  state.menu = { id: `M${state.log.length + 1}`, initiatorId, activeSelectId: `S${state.log.length + 1}`, selects: [select], priorityPlayerId: state.playerOrder.find((id) => id !== initiatorId), consecutivePasses: 0 };
  state.priorityPlayerId = state.menu.priorityPlayerId;
  addLog(state, { type: 'MENU_OPENED', menuId: state.menu.id, initiatorId, select: select.kind });
}

function resolveMenu(state, cardIndex) {
  const menu = state.menu;
  const selections = [...menu.selects].reverse();
  state.menu = null;
  state.priorityPlayerId = state.activePlayerId;
  for (const select of selections) {
    if (select.kind === 'ADD_TO_PARTY') {
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
      addLog(state, { type: 'EQUIPMENT_ATTACHED', playerId: player.id, equipmentId: gear.instanceId, hostId: host.instanceId });
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
            if (program.bonus?.when === 'no-equipment' && !Object.values(state.instances).some((gear) => gear.zone === 'attached' && gear.attachedTo === targetId)) amount += program.bonus.amount;
            target.battlefield.currentHp = Math.min(target.battlefield.maxHp, target.battlefield.currentHp + amount);
            addLog(state, { type: 'HP_RESTORED', playerId: select.playerId, sourceCardId: card.id, targetId, amount });
          }
        }
      }
      if (instance && card?.type !== 'Character') {
        instance.zone = 'continue';
        state.players[instance.ownerId].zones.continue.push(instance.instanceId);
      }
      addLog(state, { type: 'EFFECT_RESOLVED', selectId: select.id, cardId: select.cardId, supported: !!program });
    } else if (select.kind === 'COMBAT') {
      resolveCombat(state, cardIndex);
    } else {
      addLog(state, { type: 'UNSUPPORTED_SELECT_SKIPPED', selectId: select.id, reason: 'No registered effect program.' });
    }
  }
  state.priorityPlayerId = state.activePlayerId;
  addLog(state, { type: 'MENU_RESOLVED', menuId: menu.id, selectCount: selections.length });
}

function hasControlledSubtype(state, playerId, subtype, cardIndex) {
  return [state.players[playerId].center, ...state.players[playerId].party].filter(Boolean)
    .some((id) => (cardIndex.get(state.instances[id]?.cardId)?.subtypes ?? []).includes(subtype));
}

function passiveEquipmentAttackBonus(state, hostId, cardIndex) {
  let bonus = 0;
  for (const gear of Object.values(state.instances).filter((x) => x.zone === 'attached' && x.attachedTo === hostId)) {
    const text = cardIndex.get(gear.cardId)?.effect_text ?? '';
    const match = text.match(/(?:^|\. )The bearer gains ([0-9,]+) ATK\.(?:\s|$)/);
    if (match) bonus += Number(match[1].replaceAll(',', ''));
    const conditional = text.match(/(?:^|\. )The bearer gains ([0-9,]+) ATK while it has damage\./);
    const host = state.instances[hostId];
    if (conditional && host.battlefield.currentHp < host.battlefield.maxHp) bonus += Number(conditional[1].replaceAll(',', ''));
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
  recipients.forEach((recipient, index) => {
    let amount = share + (index === 0 ? remainder : 0);
    for (const gear of Object.values(state.instances).filter((x) => x.zone === 'attached' && x.attachedTo === recipient.instanceId)) {
      const text = cardIndex.get(gear.cardId)?.effect_text ?? '';
      const reduced = text.match(/(?:^|\. )(?:its|the bearer’s|the bearer's) combat damage taken is reduced by ([0-9,]+)\./i);
      if (reduced) amount = Math.max(0, amount - Number(reduced[1].replaceAll(',', '')));
    }
    recipient.battlefield.currentHp -= amount;
    addLog(state, { type: 'COMBAT_DAMAGE', targetId: recipient.instanceId, amount, remainingHp: recipient.battlefield.currentHp });
  });
  participants.forEach((instance) => { instance.usage.attackedThisTurn = true; });
  const declaredLead = combat.attackerIds[0];
  if (declaredLead === initiator.center) initiator.turn.freeMainAttackUsed = true;
  else initiator.turn.freePartyAttackUsed = true;
  const defeated = recipients.filter((x) => x.battlefield.currentHp <= 0);
  for (const victim of defeated) {
    const owner = state.players[victim.controllerId];
    const isMain = owner.center === victim.instanceId;
    if (isMain) {
      owner.life = Math.max(0, owner.life - 2);
      initiator.resources.momentum += 2;
      victim.battlefield.currentHp = victim.battlefield.maxHp;
      victim.usage.attackedThisTurn = false;
      victim.battlefield.generation = (victim.battlefield.generation ?? 1) + 1;
    } else {
      owner.life = Math.max(0, owner.life - 1);
      initiator.resources.momentum += 1;
      owner.party = owner.party.map((id) => id === victim.instanceId ? null : id);
      victim.zone = 'continue'; victim.battlefield = null;
      owner.zones.continue.push(victim.instanceId);
      for (const gear of Object.values(state.instances).filter((x) => x.zone === 'attached' && x.attachedTo === victim.instanceId)) {
        gear.zone = 'arsenal'; gear.attachedTo = null; gear.controllerId = gear.ownerId;
        state.players[gear.ownerId].zones.arsenal.push(gear.instanceId);
      }
    }
    addLog(state, { type: 'BATTLE_DEFEAT', victimId: victim.instanceId, playerId: owner.id, mainCharacter: isMain });
  }
  const down = state.playerOrder.filter((id) => state.players[id].life <= 0);
  if (down.length) { state.status = 'finished'; state.winnerId = down.length === 2 ? null : state.playerOrder.find((id) => !down.includes(id)); }
  state.combat = null;
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

  if (state.status !== 'active' && action.type !== 'START_GAME') fail('GAME_NOT_ACTIVE', 'The game is not active.');
  if (state.menu) {
    if (action.playerId !== state.menu.priorityPlayerId) fail('NO_PRIORITY', 'Only the player with priority may act in this Menu.');
    if (action.type === 'PASS') {
      state.menu.consecutivePasses += 1;
      if (state.menu.consecutivePasses >= 2) resolveMenu(state, cardIndex);
      else state.menu.priorityPlayerId = state.playerOrder.find((id) => id !== action.playerId);
      return state;
    }
    if (action.type === 'ASSIGN_GUARDS') {
      if (!state.combat || state.combat.initiatorId === player.id) fail('NOT_DEFENDING', 'Only the defender may assign Allied Guards in this combat Menu.');
      const chosen = action.guardInstanceIds ?? [];
      if (new Set(chosen).size !== chosen.length || chosen.some((id) => state.combat.guardIds.includes(id))) fail('INVALID_GUARDS', 'Choose distinct Party Members that are not already guarding.');
      const legal = chosen.map((id) => state.instances[id]);
      if (legal.some((instance) => !instance?.battlefield || instance.controllerId !== player.id || instance.battlefield.position === 'center')) fail('INVALID_GUARDS', 'Allied Guards must be controlled Party Members.');
      const cost = legal.length * 2;
      if (player.resources.momentum < cost) fail('INSUFFICIENT_RESOURCE', 'Pay 2 Momentum for each Allied Guard before responses.');
      player.resources.momentum -= cost;
      state.combat.guardIds.push(...chosen);
      state.menu.selects.push({ id: `S${state.log.length + 1}`, kind: 'ALLIED_GUARD', playerId: player.id, guardInstanceIds: chosen });
      state.menu.consecutivePasses = 0;
      state.menu.priorityPlayerId = state.playerOrder.find((id) => id !== action.playerId);
      addLog(state, { type: 'ALLIED_GUARD_ASSIGNED', playerId: player.id, guardInstanceIds: chosen, cost });
      return state;
    }
    if (action.type === 'ACTIVATE_SPEED') {
      const instance = state.instances[action.instanceId];
      const card = instance && cardIndex.get(instance.cardId);
      const program = card && getEffectProgram(card.id);
      if (!instance || instance.zone !== 'hand' || card?.type !== 'Speed Ability' || !program) fail('ILLEGAL_SPEED', 'This Speed Ability has no registered, tested response program in the current engine slice.');
      if (player.turn.nameLimits[card.name]) fail('NAME_LIMIT', `${card.name} is limited to one activation per turn.`);
      if (program.timing !== 'opponent-attack-response' || !state.combat || state.combat.initiatorId === player.id || state.combat.targetId !== action.targets?.[0]) fail('WRONG_TIMING', `${card.name} may be activated only when an opponent attacks its eligible target.`);
      const speedTarget = state.instances[action.targets?.[0]];
      if (!speedTarget?.battlefield || speedTarget.controllerId !== player.id || speedTarget.battlefield.currentHp >= speedTarget.battlefield.maxHp / 2) fail('ILLEGAL_TARGET', 'The target must be your attacked Character below half its maximum HP.');
      if (!(program.requires ?? []).every((tag) => hasControlledSubtype(state, player.id, tag, cardIndex))) fail('REQUIREMENT_FAILED', 'You do not control the required subtype.');
      const cost = card.cost ?? { momentum: 0, light: 0, darkness: 0 };
      for (const key of ['momentum', 'light', 'darkness']) if ((player.resources[key] ?? 0) < (cost[key] ?? 0)) fail('INSUFFICIENT_RESOURCE', `Not enough ${key}.`);
      for (const key of ['momentum', 'light', 'darkness']) player.resources[key] -= cost[key] ?? 0;
      player.resources.momentum += 1;
      player.zones.hand.splice(player.zones.hand.indexOf(instance.instanceId), 1);
      instance.zone = 'pending';
      player.turn.nameLimits[card.name] = true;
      state.menu.selects.push({ id: `S${state.log.length + 1}`, kind: 'CARD_EFFECT', playerId: player.id, instanceId: instance.instanceId, cardId: card.id, targets: action.targets ?? [] });
      state.menu.consecutivePasses = 0;
      state.menu.priorityPlayerId = state.playerOrder.find((id) => id !== action.playerId);
      addLog(state, { type: 'SPEED_ABILITY_ACTIVATED', playerId: player.id, cardId: card.id, instanceId: instance.instanceId });
      return state;
    }
    fail('MENU_ACTION_UNSUPPORTED', 'This action is not implemented in the current engine slice.');
  }

  if (action.playerId !== state.activePlayerId || action.playerId !== state.priorityPlayerId) fail('NOT_ACTIVE_PLAYER', 'Only the active player may act outside a Menu.');
  if (action.type === 'ADVANCE_PHASE') {
    if (state.phase === 'main') state.phase = 'battle';
    else if (state.phase === 'battle') state.phase = 'end';
    else if (state.phase === 'end') startNextTurn(state, cardIndex);
    else fail('ILLEGAL_PHASE', 'The phase cannot advance now.');
    state.priorityPlayerId = state.activePlayerId;
    addLog(state, { type: 'PHASE_ADVANCED', phase: state.phase, activePlayerId: state.activePlayerId });
    return state;
  }
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
  if (action.type === 'ATTACH_EQUIPMENT') {
    if (state.phase !== 'main') fail('WRONG_PHASE', 'Standard Equipment attachment is a Main Phase action.');
    const gear = state.instances[action.equipmentInstanceId], card = gear && cardIndex.get(gear.cardId), host = state.instances[action.hostInstanceId];
    if (!gear || gear.zone !== 'arsenal' || gear.ownerId !== player.id || card?.type !== 'Equipment') fail('ILLEGAL_EQUIPMENT', 'Choose Equipment from your own arsenal.');
    if (!host || host.controllerId !== player.id || !host.battlefield) fail('ILLEGAL_HOST', 'Equipment must attach to your Character.');
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
    if (!action.targets?.[0]) fail('TARGET_REQUIRED', `${card.name} requires a Character target.`);
    const target = state.instances[action.targets[0]];
    if (!target?.battlefield || target.controllerId !== player.id) fail('ILLEGAL_TARGET', 'Choose a Character you control.');
    for (const key of ['momentum', 'light', 'darkness']) if (player.resources[key] < (card.cost?.[key] ?? 0)) fail('INSUFFICIENT_RESOURCE', `Not enough ${key}.`);
    for (const key of ['momentum', 'light', 'darkness']) player.resources[key] -= card.cost?.[key] ?? 0;
    player.turn.nameLimits[card.name] = true;
    player.zones.hand.splice(player.zones.hand.indexOf(instance.instanceId), 1); instance.zone = 'pending';
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'CARD_EFFECT', playerId: player.id, instanceId: instance.instanceId, cardId: card.id, targets: action.targets ?? [] });
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
    if (extras.some((x) => !x?.battlefield || x.controllerId !== player.id || x.usage.attackedThisTurn || x.battlefield.position === 'center')) fail('INVALID_CHAIN', 'Each extra attacker must be an unused allied Party Member.');
    const extraCost = 2 * extras.length;
    if (player.resources.momentum < extraCost) fail('INSUFFICIENT_RESOURCE', 'Pay 2 Momentum for each additional attacker before responses.');
    for (const instance of extras) if (!instance || instance.battlefield.position === 'center') fail('INVALID_CHAIN', 'The Main Character cannot assist as a Party Member.');
    player.resources.momentum -= extraCost;
    state.combat = { initiatorId: player.id, attackerIds: [attacker.instanceId, ...extra], targetId: target.instanceId, guardIds: [], declaredAtTurn: state.turnNumber };
    openMenu(state, player.id, { id: `S${state.log.length + 1}`, kind: 'COMBAT', combat: clone(state.combat) });
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
  if (state.menu) {
    if (state.menu.priorityPlayerId !== playerId) return [];
    const actions = [{ type: 'PASS' }];
    if (state.combat && state.combat.initiatorId !== playerId) {
      const eligible = player.party.filter(Boolean).filter((id) => !state.combat.guardIds.includes(id));
      if (eligible.length && player.resources.momentum >= 2) actions.push({ type: 'ASSIGN_GUARDS', eligibleInstanceIds: eligible, costEach: 2 });
    }
    for (const id of player.zones.hand) {
      const card = cardIndex.get(state.instances[id].cardId), program = card && getEffectProgram(card.id);
      if (card?.type !== 'Speed Ability' || !program || player.turn.nameLimits[card.name]) continue;
      if (program.timing === 'opponent-attack-response' && state.combat?.initiatorId !== playerId) {
        const target = state.instances[state.combat?.targetId];
        if (target?.controllerId === playerId && target.battlefield.currentHp < target.battlefield.maxHp / 2 && (program.requires ?? []).every((tag) => hasControlledSubtype(state, playerId, tag, cardIndex))) actions.push({ type: 'ACTIVATE_SPEED', instanceId: id, targets: [target.instanceId] });
      }
    }
    return actions;
  }
  if (state.activePlayerId !== playerId) return [];
  const actions = [{ type: 'ADVANCE_PHASE' }];
  if (state.phase === 'main') {
    if (!player.turn.standardAddUsed && emptyPartyIndex(player) >= 0) for (const id of player.zones.hand) if (cardIndex.get(state.instances[id].cardId)?.type === 'Character' && !cardIndex.get(state.instances[id].cardId).transformation) actions.push({ type: 'ADD_TO_PARTY', instanceId: id });
    for (const id of player.zones.arsenal) {
      const equipment = cardIndex.get(state.instances[id].cardId), cost = equipment?.cost ?? {};
      if (player.resources.light < (cost.light ?? 0) || player.resources.darkness < (cost.darkness ?? 0)) continue;
      for (const hostId of [player.center, ...player.party].filter(Boolean)) if (requirementsMet(equipment ?? {}, state.instances[hostId], cardIndex)) actions.push({ type: 'ATTACH_EQUIPMENT', equipmentInstanceId: id, hostInstanceId: hostId });
    }
    for (const id of player.zones.hand) {
      const card = cardIndex.get(state.instances[id].cardId), program = card && getEffectProgram(card.id);
      if (card?.type === 'Ability' && program?.timing === 'main' && !player.turn.nameLimits[card.name]) actions.push({ type: 'ACTIVATE_ABILITY', instanceId: id, targetOptions: [player.center, ...player.party].filter(Boolean) });
      if (card?.type === 'Speed Ability' && program?.timing === 'main' && !player.turn.nameLimits[card.name]) actions.push({ type: 'ACTIVATE_SPEED', instanceId: id });
    }
  }
  if (state.phase === 'battle' && !(state.turnNumber === 1 && state.activePlayerId === state.playerOrder[0])) {
    const enemies = state.playerOrder.filter((id) => id !== playerId).flatMap((id) => [state.players[id].center, ...state.players[id].party].filter(Boolean));
    const attackers = [];
    if (!player.turn.freeMainAttackUsed && !state.instances[player.center].usage.attackedThisTurn) attackers.push(player.center);
    if (!player.turn.freePartyAttackUsed) attackers.push(...player.party.filter((id) => id && !state.instances[id].usage.attackedThisTurn));
    for (const attackerInstanceId of attackers) for (const targetInstanceId of enemies) {
      actions.push({ type: 'DECLARE_ATTACK', attackerInstanceId, targetInstanceId, availableChainIds: player.party.filter((id) => id && id !== attackerInstanceId && !state.instances[id].usage.attackedThisTurn && player.resources.momentum >= 2) });
    }
  }
  return actions;
}

export function assertStateInvariants(state, cards) {
  const cardIndex = indexCards(cards), seen = new Set();
  for (const player of Object.values(state.players)) {
    const allZones = [...player.zones.mainDeck, ...player.zones.hand, ...player.zones.continue, ...player.zones.arsenal, ...player.zones.baseReserve, player.center, ...player.party].filter(Boolean);
    for (const id of allZones) { if (seen.has(id)) fail('ZONE_DUPLICATION', `${id} appears in more than one zone.`); seen.add(id); }
    for (const id of allZones) if (!state.instances[id]) fail('UNKNOWN_INSTANCE', `${id} has no card instance record.`);
    const center = player.center && state.instances[player.center];
    if (!center?.battlefield || center.battlefield.position !== 'center' || center.controllerId !== player.id) fail('CENTER_INVARIANT', `${player.id} must control one Character in Center.`);
    for (const id of player.party.filter(Boolean)) { const c=state.instances[id]; if(!c?.battlefield||c.battlefield.position==='center'||c.controllerId!==player.id) fail('PARTY_INVARIANT',`${id} is not a controlled Party Member.`); }
  }
  for (const instance of Object.values(state.instances)) if (instance.zone === 'attached' && (!instance.attachedTo || !state.instances[instance.attachedTo]?.battlefield)) fail('ATTACHMENT_INVARIANT', `${instance.instanceId} has no legal host.`);
  if (seen.size !== Object.values(state.instances).filter((instance) => instance.zone !== 'pending' && instance.zone !== 'attached' && instance.zone !== 'underlay').length) fail('ZONE_CONSERVATION', 'A card instance is missing from its owner’s public or private zones.');
  return true;
}
import { getEffectProgram } from './effects.js';
