import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCards, allCards } from '../src/data/cards.js';
import { createInitialState, dispatch, getLegalActions, assertStateInvariants, RuleError } from '../src/engine/game.js';
import { supportedTransformationIds, transformationRequirementMet } from '../src/engine/transformations.js';

await loadCards();
const cards = allCards();
const ids = new Set(cards.map((card) => card.id));
function deck(starter, duplicateStarter = false, transformationId = null) {
  const required = [starter, 'CS1-002', 'CS1-004', 'CS1-009', 'CS1-014', 'CS1-023', 'CS1-024', 'CS1-031', 'CS1-035', 'CS1-054', 'CS1-059', 'CS1-060', 'CS1-090', 'CS1-281', 'CS1-282', 'CS1-283', 'CS1-285', 'CS1-290', 'CS1-311', 'CS1-316', 'CS1-319', 'CS1-320', 'CS1-334', 'CS1-339', 'CS1-394', 'CS1-433', 'CS1-436'];
  const extras = cards.filter((card) => card.type === 'Character' && !card.transformation).map((card) => card.id);
  const mainIds = [...new Set([...required, ...extras])].slice(0, 40);
  if (duplicateStarter) mainIds.splice(1, 0, starter);
  assert.ok(mainIds.length >= 40 && mainIds.length <= 60);
  const equipmentIds = cards.filter((card) => card.type === 'Equipment').slice(0, transformationId ? 18 : 20).map((card) => card.id);
  if (transformationId) equipmentIds.push(transformationId);
  assert.equal(new Set(mainIds).size, 40);
  return { mainIds, equipmentIds };
}
function game(p1Starter = 'CS1-060', duplicateStarter = false, transformationId = null) {
  const state = createInitialState({
    players: [
      { id: 'p1', name: 'Player One', deck: deck(p1Starter, duplicateStarter, transformationId) },
      { id: 'p2', name: 'Player Two', deck: deck('CS1-031') }
    ], chooserId: 'p2', seed: 42, cards
  });
  state.testSetupMainIds = { p1: p1Starter, p2: 'CS1-031' };
  return state;
}
function selectStartingMain(state, playerId, cardId) {
  const action = getLegalActions(state, playerId, cards).find((candidate) => candidate.type === 'SELECT_STARTING_MAIN' && state.instances[candidate.instanceId].cardId === cardId);
  assert.ok(action, `expected ${cardId} to be offered as ${playerId}'s starting Main`);
  return dispatch(state, { ...action, playerId }, cards);
}
function start(g) {
  let s = dispatch(g, { type: 'CHOOSE_FIRST_PLAYER', playerId: g.firstPlayerChooserId, firstPlayerId: 'p1' }, cards);
  for (const playerId of s.startingMainOrder) s = selectStartingMain(s, playerId, s.testSetupMainIds[playerId]);
  s = dispatch(s, { type: 'MULLIGAN', playerId: 'p1', instanceIds: [] }, cards);
  s = dispatch(s, { type: 'MULLIGAN', playerId: 'p2', instanceIds: [] }, cards);
  return s;
}
function passMenu(s) {
  const first = s.menu.priorityPlayerId;
  s = dispatch(s, { type: 'PASS', playerId: first }, cards);
  return dispatch(s, { type: 'PASS', playerId: s.menu.priorityPlayerId }, cards);
}
function advancePhase(s, playerId = s.activePlayerId) {
  assert.equal(s.activePlayerId, playerId);
  assert.equal(s.priorityPlayerId, playerId);
  s = dispatch(s, { type: 'PASS_PRIORITY', playerId }, cards);
  return dispatch(s, { type: 'PASS_PRIORITY', playerId: s.priorityPlayerId }, cards);
}
function moveCardToHand(state, playerId, cardId) {
  const player = state.players[playerId];
  const already = player.zones.hand.find((id) => state.instances[id].cardId === cardId);
  if (already) return already;
  const instanceId = player.zones.mainDeck.find((id) => state.instances[id].cardId === cardId);
  assert.ok(instanceId, `expected ${cardId} in ${playerId} Main Deck`);
  player.zones.mainDeck = player.zones.mainDeck.filter((id) => id !== instanceId);
  player.zones.hand.push(instanceId);
  state.instances[instanceId].zone = 'hand';
  return instanceId;
}
function moveCardToTop(state, playerId, cardId) {
  const player = state.players[playerId];
  const instanceId = player.zones.hand.find((id) => state.instances[id].cardId === cardId)
    ?? player.zones.mainDeck.find((id) => state.instances[id].cardId === cardId);
  assert.ok(instanceId, `expected ${cardId} in ${playerId}'s hand or Main Deck`);
  player.zones.hand = player.zones.hand.filter((id) => id !== instanceId);
  player.zones.mainDeck = player.zones.mainDeck.filter((id) => id !== instanceId);
  state.instances[instanceId].zone = 'mainDeck';
  player.zones.mainDeck.unshift(instanceId);
  return instanceId;
}

test('initialization validates registration, chooses a starting Main, and deals five cards', () => {
  const s = start(game());
  assert.equal(s.players.p1.life, 15);
  assert.deepEqual(s.players.p1.resources, { momentum: 5, light: 0, darkness: 0 });
  assert.equal(s.players.p1.zones.hand.length, 5);
  assert.equal(s.players.p1.center && s.instances[s.players.p1.center].cardId, 'CS1-060');
  assert.equal(s.instances[s.players.p1.center].battlefield.maxHp, cards.find((x) => x.id === 'CS1-060').statistics.hp + 13000);
  assertStateInvariants(s, cards);
});

test('the randomly selected chooser makes the first-player choice through a validated setup action', () => {
  let s = createInitialState({
    players: [
      { id: 'p1', name: 'Player One', deck: deck('CS1-060') },
      { id: 'p2', name: 'Player Two', deck: deck('CS1-031') }
    ],
    chooserId: 'p2', seed: 42, cards
  });
  assert.equal(s.phase, 'first-player-choice');
  assert.equal(s.players.p1.center, null);
  assert.equal(s.players.p1.zones.hand.length, 0);
  assertStateInvariants(s, cards);
  assert.deepEqual(getLegalActions(s, 'p1', cards), []);
  const actions = getLegalActions(s, 'p2', cards);
  assert.deepEqual(actions.map((action) => action.firstPlayerId), ['p1', 'p2']);
  assert.throws(() => dispatch(s, { type: 'MULLIGAN', playerId: 'p2', instanceIds: [] }, cards), (error) => error.code === 'SETUP_ONLY');
  assert.throws(() => dispatch(s, { type: 'CHOOSE_FIRST_PLAYER', playerId: 'p1', firstPlayerId: 'p1' }, cards), (error) => error.code === 'CHOOSER_ONLY');
  s = dispatch(s, { type: 'CHOOSE_FIRST_PLAYER', playerId: 'p2', firstPlayerId: 'p2' }, cards);
  assert.equal(s.phase, 'starting-main-selection');
  assert.deepEqual(s.playerOrder, ['p2', 'p1']);
  assert.equal(s.activePlayerId, 'p2');
  assert.equal(s.log.at(-1).type, 'FIRST_PLAYER_CHOSEN');
  assertStateInvariants(s, cards);
  const choices = getLegalActions(s, 'p2', cards);
  assert.ok(choices.some((action) => s.instances[action.instanceId].cardId === 'CS1-031'));
  assert.ok(choices.every((action) => cards.find((card) => card.id === s.instances[action.instanceId].cardId)?.type === 'Character'));
  const abilityId = s.players.p2.zones.mainDeck.find((id) => cards.find((card) => card.id === s.instances[id].cardId)?.type === 'Ability');
  assert.throws(() => dispatch(s, { type: 'SELECT_STARTING_MAIN', playerId: 'p2', instanceId: abilityId }, cards), (error) => error.code === 'ILLEGAL_STARTER');
  assert.throws(() => dispatch(s, { type: 'MULLIGAN', playerId: 'p2', instanceIds: [] }, cards), (error) => error.code === 'SETUP_ONLY');
  assert.throws(() => dispatch(s, { type: 'SELECT_STARTING_MAIN', playerId: 'p1', instanceId: choices[0].instanceId }, cards), (error) => error.code === 'STARTING_MAIN_ORDER');
  s = selectStartingMain(s, 'p2', 'CS1-031');
  assert.equal(s.phase, 'starting-main-selection');
  assertStateInvariants(s, cards);
  assert.deepEqual(getLegalActions(s, 'p2', cards), []);
  s = selectStartingMain(s, 'p1', 'CS1-060');
  assert.equal(s.phase, 'mulligan');
  assert.deepEqual(s.mulliganOrder, ['p2', 'p1']);
  assert.equal(s.players.p1.zones.hand.length, 5);
  assert.equal(s.players.p2.zones.hand.length, 5);
  assert.equal(s.instances[s.players.p2.center].cardId, 'CS1-031');
  assertStateInvariants(s, cards);
});

test('ordered mulligans preserve card count and open the first Main Phase', () => {
  let s = game();
  s = dispatch(s, { type: 'CHOOSE_FIRST_PLAYER', playerId: 'p2', firstPlayerId: 'p1' }, cards);
  s = selectStartingMain(s, 'p1', 'CS1-060');
  s = selectStartingMain(s, 'p2', 'CS1-031');
  assert.throws(() => dispatch(s, { type: 'MULLIGAN', playerId: 'p2', instanceIds: [] }, cards), RuleError);
  const returned = s.players.p1.zones.hand.slice(0, 2);
  s = dispatch(s, { type: 'MULLIGAN', playerId: 'p1', instanceIds: returned }, cards);
  assert.equal(s.players.p1.zones.hand.length, 5);
  s = dispatch(s, { type: 'MULLIGAN', playerId: 'p2', instanceIds: [] }, cards);
  assert.equal(s.status, 'active');
  assert.equal(s.phase, 'main');
  assertStateInvariants(s, cards);
});

test('empty phase windows require two consecutive passes and return priority to the active player', () => {
  let s = start(game());
  assert.throws(() => dispatch(s, { type: 'ADVANCE_PHASE', playerId: 'p1' }, cards), (error) => error.code === 'PHASE_REQUIRES_PASSES');
  assert.ok(getLegalActions(s, 'p1', cards).some((action) => action.type === 'PASS_PRIORITY'));
  assert.deepEqual(getLegalActions(s, 'p2', cards), []);
  s = dispatch(s, { type: 'PASS_PRIORITY', playerId: 'p1' }, cards);
  assert.equal(s.phase, 'main');
  assert.equal(s.phasePasses, 1);
  assert.equal(s.priorityPlayerId, 'p2');
  assert.throws(() => dispatch(s, { type: 'PASS_PRIORITY', playerId: 'p1' }, cards), (error) => error.code === 'NO_PRIORITY');
  assert.deepEqual(getLegalActions(s, 'p2', cards), [{ type: 'PASS_PRIORITY' }]);
  s = dispatch(s, { type: 'PASS_PRIORITY', playerId: 'p2' }, cards);
  assert.equal(s.phase, 'battle');
  assert.equal(s.phasePasses, 0);
  assert.equal(s.priorityPlayerId, 'p1');
});

test('standard Add to Party opens a Menu and deploys only after two passes', () => {
  let s = start(game());
  const character = s.players.p1.zones.hand.find((id) => cards.find((c) => c.id === s.instances[id].cardId).type === 'Character');
  assert.ok(character);
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: character }, cards);
  assert.ok(s.menu);
  assert.equal(s.players.p1.party.filter(Boolean).length, 0);
  assert.throws(() => dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: character }, cards), RuleError);
  s = passMenu(s);
  assert.equal(s.menu, null);
  assert.equal(s.players.p1.party.filter(Boolean).length, 1);
  assertStateInvariants(s, cards);
});

test('free Center switch opens a Menu, adjusts both Characters by 13000 HP, and is once per turn', () => {
  let s = start(game());
  const partyCard = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: partyCard }, cards);
  s = passMenu(s);
  const outgoingId = s.players.p1.center, incomingId = s.players.p1.party[0];
  s.instances[outgoingId].battlefield.currentHp = 9000;
  s.instances[incomingId].battlefield.currentHp -= 2000;
  const oldMainMax = s.instances[outgoingId].battlefield.maxHp;
  const oldPartyMax = s.instances[incomingId].battlefield.maxHp;
  s = dispatch(s, { type: 'SWITCH_CENTER', playerId: 'p1', partyInstanceId: incomingId }, cards);
  assert.equal(s.players.p1.center, outgoingId);
  assert.ok(s.menu);
  s = passMenu(s);
  assert.equal(s.players.p1.center, incomingId);
  assert.equal(s.players.p1.party[0], outgoingId);
  assert.equal(s.instances[outgoingId].battlefield.currentHp, 1);
  assert.equal(s.instances[outgoingId].battlefield.maxHp, oldMainMax - 13000);
  assert.equal(s.instances[incomingId].battlefield.currentHp, cards.find((c) => c.id === s.instances[incomingId].cardId).statistics.hp - 2000 + 13000);
  assert.equal(s.instances[incomingId].battlefield.maxHp, oldPartyMax + 13000);
  assert.throws(() => dispatch(s, { type: 'SWITCH_CENTER', playerId: 'p1', partyInstanceId: outgoingId }, cards), (error) => error.code === 'CENTER_SWITCH_USED');
  assertStateInvariants(s, cards);
});

test('Party Swap pays six Momentum, returns one or two untransformed Party Members, and refunds printed Equipment costs only', () => {
  let s = start(game());
  for (const cardId of ['CS1-001', 'CS1-002']) {
    const id = moveCardToHand(s, 'p1', cardId);
    s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: id }, cards);
    s = passMenu(s);
    s.players.p1.turn.standardAddUsed = false;
  }
  const [firstId, secondId] = s.players.p1.party.filter(Boolean);
  const gearId = s.players.p1.zones.arsenal.find((id) => cards.find((c) => c.id === s.instances[id].cardId)?.type === 'Equipment');
  const gearCard = cards.find((c) => c.id === s.instances[gearId].cardId);
  s.players.p1.zones.arsenal = s.players.p1.zones.arsenal.filter((id) => id !== gearId);
  s.instances[gearId].zone = 'attached'; s.instances[gearId].attachedTo = firstId;
  s.instances[firstId].battlefield.currentHp -= 5000;
  s.players.p1.resources.momentum = 8;
  const lightBefore = s.players.p1.resources.light, darknessBefore = s.players.p1.resources.darkness;
  const lightRefund = (gearCard.cost?.light ?? 0) === 1 ? 1 : Math.floor((gearCard.cost?.light ?? 0) / 2);
  const darknessRefund = (gearCard.cost?.darkness ?? 0) === 1 ? 1 : Math.floor((gearCard.cost?.darkness ?? 0) / 2);
  s = dispatch(s, { type: 'PARTY_SWAP', playerId: 'p1', instanceIds: [firstId, secondId] }, cards);
  assert.equal(s.players.p1.resources.momentum, 2);
  assert.ok(s.menu);
  s = passMenu(s);
  assert.equal(s.players.p1.party.filter(Boolean).length, 0);
  assert.ok(s.players.p1.zones.hand.some((id) => s.instances[id].cardId === 'CS1-001'));
  assert.ok(s.players.p1.zones.hand.some((id) => s.instances[id].cardId === 'CS1-002'));
  assert.notEqual(s.players.p1.zones.hand.find((id) => s.instances[id].cardId === 'CS1-001'), firstId);
  assert.equal(s.instances[firstId].zone, 'retired');
  assert.ok(s.players.p1.zones.arsenal.includes(gearId));
  assert.equal(s.players.p1.resources.light, lightBefore + lightRefund);
  assert.equal(s.players.p1.resources.darkness, darknessBefore + darknessRefund);
  assertStateInvariants(s, cards);
});

test('Party Swap rejects transformed Members and unaffordable actions before opening a Menu', () => {
  let s = start(game());
  const id = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: id }, cards);
  s = passMenu(s);
  s.players.p1.resources.momentum = 5;
  assert.throws(() => dispatch(s, { type: 'PARTY_SWAP', playerId: 'p1', instanceIds: [s.players.p1.party[0]] }, cards), (error) => error.code === 'INSUFFICIENT_RESOURCE');
  s.players.p1.resources.momentum = 6;
  const transformed = cards.find((card) => card.transformation)?.id;
  assert.ok(transformed);
  s.instances[s.players.p1.party[0]].cardId = transformed;
  assert.throws(() => dispatch(s, { type: 'PARTY_SWAP', playerId: 'p1', instanceIds: [s.players.p1.party[0]] }, cards), (error) => error.code === 'TRANSFORMED_SWAP');
  assert.equal(s.menu, null);
});

test('Aether Channel chooses a Light or Darkness burst for a Mage/Warrior pair and locks both from new Equipment', () => {
  let s = start(game('CS1-031'));
  const soraId = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: soraId }, cards);
  s = passMenu(s);
  const abilityId = moveCardToHand(s, 'p1', 'CS1-316');
  const beforeLight = s.players.p1.resources.light, beforeDarkness = s.players.p1.resources.darkness;
  const legal = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === abilityId && action.resourceChoice === 'light');
  assert.ok(legal);
  s = dispatch(s, { ...legal, playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.equal(s.players.p1.resources.light, beforeLight + 2);
  assert.equal(s.players.p1.resources.darkness, beforeDarkness);
  assert.deepEqual(new Set(s.players.p1.turn.equipmentLockedInstanceIds), new Set([s.players.p1.center, soraId]));
  const gearId = s.players.p1.zones.arsenal.find((id) => s.instances[id].cardId === 'CS1-181');
  assert.ok(gearId);
  assert.equal(getLegalActions(s, 'p1', cards).some((action) => action.type === 'ATTACH_EQUIPMENT' && action.hostInstanceId === soraId), false);
  assert.throws(() => dispatch(s, { type: 'ATTACH_EQUIPMENT', playerId: 'p1', equipmentInstanceId: gearId, hostInstanceId: soraId }, cards), (error) => error.code === 'ATTACHMENT_LOCKED');
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  assert.deepEqual(s.players.p1.turn.equipmentLockedInstanceIds, []);
  assertStateInvariants(s, cards);
});

test('Armiger Preparation turns a geared Sword Wielder into both resource colors and suppresses the next attachment', () => {
  let s = start(game('CS1-001'));
  const player = s.players.p1, hostId = player.center;
  player.resources.light = 100;
  player.resources.darkness = 100;
  const compatible = (equipment) => {
    const character = cards.find((card) => card.id === s.instances[hostId].cardId);
    const tags = new Set([...character.subtypes, ...character.combat_subtypes, ...character.franchise_subtypes, ...character.species_nature]);
    const req = equipment.requirements ?? { all: [], any: [] };
    return (req.all ?? []).every((tag) => tags.has(tag)) && (req.any ?? []).every((group) => (Array.isArray(group) ? group.some((tag) => tags.has(tag)) : tags.has(group)));
  };
  const attachOne = () => {
    const action = getLegalActions(s, 'p1', cards).find((candidate) => candidate.type === 'ATTACH_EQUIPMENT' && candidate.hostInstanceId === hostId && compatible(cards.find((card) => card.id === s.instances[candidate.equipmentInstanceId].cardId)));
    assert.ok(action, 'expected another compatible Equipment attachment');
    const id = action.equipmentInstanceId;
    s = dispatch(s, { ...action, playerId: 'p1' }, cards);
    s = passMenu(s);
    return id;
  };
  attachOne(); attachOne(); attachOne();
  const armigerId = moveCardToHand(s, 'p1', 'CS1-311');
  assert.ok(getLegalActions(s, 'p1', cards).some((action) => action.type === 'ACTIVATE_ABILITY' && action.abilityKind === 'armiger-preparation'));
  const before = { light: s.players.p1.resources.light, darkness: s.players.p1.resources.darkness };
  const activation = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === armigerId);
  assert.ok(activation);
  s = dispatch(s, { ...activation, playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.equal(s.players.p1.resources.light, before.light + 1);
  assert.equal(s.players.p1.resources.darkness, before.darkness + 1);
  assert.equal(s.players.p1.turn.suppressNextEquipmentAbilities, true);
  const fourthGearId = attachOne();
  const fourthGear = s.instances[fourthGearId];
  assert.equal(fourthGear.abilitiesSuppressedUntilTurn, s.turnNumber + 2);
  assert.equal(s.players.p1.turn.suppressNextEquipmentAbilities, false);
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  assert.equal(s.turnNumber, 2);
  assert.ok(fourthGear.abilitiesSuppressedUntilTurn > s.turnNumber, 'suppression remains during the opponent turn');
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p2');
  assert.equal(s.turnNumber, 3);
  assert.ok(!(s.instances[fourthGearId].abilitiesSuppressedUntilTurn > s.turnNumber), 'suppression expires when its controller’s next turn begins');
  assertStateInvariants(s, cards);
});

test('Theurgy Charge bottoms a hand card as an upfront cost, then grants Momentum and disables Finishers for the turn', () => {
  let s = start(game('CS1-060'));
  const makotoId = moveCardToHand(s, 'p1', 'CS1-059');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: makotoId }, cards);
  s = passMenu(s);
  const abilityId = moveCardToHand(s, 'p1', 'CS1-319');
  const costId = s.players.p1.zones.hand.find((id) => id !== abilityId);
  assert.ok(costId);
  const before = s.players.p1.resources.momentum;
  s = dispatch(s, { type: 'ACTIVATE_ABILITY', playerId: 'p1', instanceId: abilityId, activationCostInstanceId: costId }, cards);
  assert.equal(s.instances[costId].zone, 'mainDeck');
  assert.equal(s.players.p1.resources.momentum, before);
  s = passMenu(s);
  assert.equal(s.players.p1.resources.momentum, before + 2);
  assert.equal(s.players.p1.turn.finisherDisabled, true);
  assert.equal(s.instances[abilityId].zone, 'continue');
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  assert.equal(s.activePlayerId, 'p2');
  assert.equal(s.players.p1.turn.finisherDisabled, false);
  assertStateInvariants(s, cards);
});

test('Blade Awakening converts a Driver hand cost into a suppressed Blade without using standard Add', () => {
  let s = start(game('CS1-089'));
  const bladeId = moveCardToHand(s, 'p1', 'CS1-090');
  const costId = moveCardToHand(s, 'p1', 'CS1-316');
  const abilityId = moveCardToHand(s, 'p1', 'CS1-339');
  const legal = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === abilityId && action.bladeInstanceId === bladeId && action.activationCostInstanceId === costId);
  assert.ok(legal);
  assert.equal(s.players.p1.turn.standardAddUsed, false);
  s = dispatch(s, { ...legal, playerId: 'p1' }, cards);
  assert.equal(s.instances[bladeId].zone, 'pending');
  assert.equal(s.instances[costId].zone, 'continue');
  s = passMenu(s);
  assert.equal(s.instances[bladeId].zone, 'party');
  assert.equal(s.instances[bladeId].battlefield.currentHp, cards.find((card) => card.id === 'CS1-090').statistics.hp);
  assert.equal(s.instances[bladeId].characterSpecialsSuppressedUntilTurn, 3);
  assert.equal(s.players.p1.turn.standardAddUsed, false);
  assert.equal(s.instances[abilityId].zone, 'continue');
  s = advancePhase(s, 'p1'); s = advancePhase(s, 'p1'); s = advancePhase(s, 'p1');
  assert.equal(s.instances[bladeId].characterSpecialsSuppressedUntilTurn, 3);
  s = advancePhase(s, 'p2'); s = advancePhase(s, 'p2'); s = advancePhase(s, 'p2');
  assert.equal(s.activePlayerId, 'p1');
  assert.equal(s.instances[bladeId].characterSpecialsSuppressedUntilTurn, undefined);
  assertStateInvariants(s, cards);
});

test('Mickey collects a last-known trigger when another allied Character is defeated and heals its current Main', () => {
  let s = start(game('CS1-031'));
  for (const cardId of ['CS1-011', 'CS1-001']) {
    const id = moveCardToHand(s, 'p1', cardId);
    s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: id }, cards);
    s = passMenu(s);
    s.players.p1.turn.standardAddUsed = false;
  }
  const mickeyId = s.players.p1.party.find((id) => s.instances[id].cardId === 'CS1-011');
  const victimId = s.players.p1.party.find((id) => s.instances[id].cardId === 'CS1-001');
  const main = s.instances[s.players.p1.center];
  main.battlefield.currentHp -= 5000;
  const beforeHeal = main.battlefield.currentHp;
  s.instances[victimId].battlefield.currentHp = 1;
  s.instances[mickeyId].battlefield.currentHp = 1;
  s = advancePhase(s, 'p1'); s = advancePhase(s, 'p1'); s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: victimId }, cards);
  s = dispatch(s, { type: 'ASSIGN_GUARDS', playerId: 'p1', guardInstanceIds: [mickeyId] }, cards);
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  const combatMenuId = s.menu.id;
  s = passMenu(s);
  assert.equal(s.instances[victimId].zone, 'continue');
  assert.equal(s.instances[mickeyId].zone, 'continue');
  assert.ok(s.menu?.triggerGroupId);
  assert.equal(s.menu.selects[0].sourceInstanceId, mickeyId);
  assert.equal(s.menu.selects[0].sourceSnapshot.instanceId, mickeyId);
  assert.equal(s.menu.selects[0].sourceSnapshot.position, 'party-0');
  assert.equal(s.menu.selects[0].eventSnapshot.defeated.length, 2);
  assert.equal(s.menu.priorityPlayerId, 'p2');
  const combatMenuResolved = s.log.findIndex((event) => event.type === 'MENU_RESOLVED' && event.menuId === combatMenuId);
  const triggerGroupOpened = s.log.findIndex((event) => event.type === 'TRIGGER_GROUP_OPENED' && event.triggerGroupId === s.menu.triggerGroupId);
  assert.ok(combatMenuResolved >= 0 && triggerGroupOpened > combatMenuResolved);
  s = passMenu(s);
  assert.equal(s.instances[s.players.p1.center].battlefield.currentHp, beforeHeal + 3000);
  assert.equal(s.players.p1.turn.nameLimits['Mickey'], true);
  assert.ok(s.log.some((event) => event.type === 'TRIGGER_COLLECTED' && event.sourceInstanceId === mickeyId));
  assertStateInvariants(s, cards);
});

test('Mickey resolution pauses for its mandatory discard choice without opening a response window', () => {
  let s = start(game('CS1-011'));
  const victimId = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: victimId }, cards);
  s = passMenu(s);
  s.instances[victimId].battlefield.currentHp = 1;
  s.instances[s.players.p1.center].battlefield.currentHp -= 4000;
  const beforeHand = s.players.p1.zones.hand.length;
  const beforeHeal = s.instances[s.players.p1.center].battlefield.currentHp;
  s = advancePhase(s, 'p1'); s = advancePhase(s, 'p1'); s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: victimId }, cards);
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.ok(s.menu?.triggerGroupId);
  s = passMenu(s);
  assert.equal(s.menu, null);
  assert.equal(s.players.p1.zones.hand.length, beforeHand + 1);
  assert.equal(s.instances[s.players.p1.center].battlefield.currentHp, beforeHeal + 3000);
  assert.ok(s.resolutionChoice);
  assert.equal(s.pendingMenuResolution.pendingTriggerId, s.resolutionChoice.triggerId);
  assertStateInvariants(s, cards);
  assert.deepEqual(getLegalActions(s, 'p2', cards), []);
  const choices = getLegalActions(s, 'p1', cards);
  assert.equal(choices.length, beforeHand + 1);
  assert.ok(choices.every((action) => action.type === 'RESOLVE_CHOICE'));
  const discardId = choices[0].instanceId;
  s = dispatch(s, { ...choices[0], playerId: 'p1' }, cards);
  assert.equal(s.resolutionChoice, null);
  assert.equal(s.pendingMenuResolution, null);
  assert.equal(s.instances[discardId].zone, 'continue');
  assert.equal(s.players.p1.zones.hand.length, beforeHand);
  assert.ok(s.log.some((event) => event.type === 'TRIGGER_RESOLVED' && event.cardId === 'CS1-011'));
  assertStateInvariants(s, cards);
});

test('Ability card Cure resolves through the Menu and goes to Continue?', () => {
  let s = start(game());
  const cureId = moveCardToHand(s, 'p1', 'CS1-281');
  const targetId = s.players.p1.center;
  const target = s.instances[targetId];
  target.battlefield.currentHp -= 7000;
  const before = target.battlefield.currentHp;
  s = dispatch(s, { type: 'ACTIVATE_ABILITY', playerId: 'p1', instanceId: cureId, targets: [targetId] }, cards);
  assert.ok(s.menu);
  s = passMenu(s);
  assert.equal(s.instances[targetId].battlefield.currentHp, Math.min(target.battlefield.maxHp, before + 5000));
  assert.equal(s.instances[cureId].zone, 'continue');
  assert.ok(s.players.p1.zones.continue.includes(cureId));
  assertStateInvariants(s, cards);
});

test('Firaga effect damage defeats and revives a Main without combat life or Momentum consequences', () => {
  let s = start(game('CS1-001'));
  const firagaId = moveCardToHand(s, 'p1', 'CS1-282');
  const targetId = s.players.p2.center;
  const target = s.instances[targetId];
  target.battlefield.currentHp = 3500;
  const p1Momentum = s.players.p1.resources.momentum;
  const p2Life = s.players.p2.life;
  const p2Momentum = s.players.p2.resources.momentum;
  const action = getLegalActions(s, 'p1', cards).find((candidate) => candidate.type === 'ACTIVATE_ABILITY' && candidate.instanceId === firagaId && candidate.targets?.[0] === targetId);
  assert.ok(action, 'Firaga can target the opposing Main Character');
  assert.throws(() => dispatch(s, { ...action, playerId: 'p1', targets: [s.players.p1.center] }, cards), (error) => error.code === 'ILLEGAL_TARGET');
  s = dispatch(s, { ...action, playerId: 'p1' }, cards);
  s = passMenu(s);
  const replacementId = s.players.p2.center;
  assert.notEqual(replacementId, targetId);
  assert.equal(s.instances[targetId].zone, 'retired');
  assert.equal(s.instances[replacementId].battlefield.currentHp, cards.find((card) => card.id === s.instances[replacementId].cardId).statistics.hp + 13000);
  assert.equal(s.players.p2.life, p2Life, 'effect damage does not cause Battle life loss');
  assert.equal(s.players.p1.resources.momentum, p1Momentum, 'effect damage does not grant defeat Momentum');
  assert.equal(s.players.p2.resources.momentum, p2Momentum);
  assert.ok(s.log.some((entry) => entry.type === 'EFFECT_DAMAGE' && entry.targetId === targetId && entry.amount === 4000));
  assert.ok(s.log.some((entry) => entry.type === 'EFFECT_DEFEAT' && entry.mainCharacter));
  assertStateInvariants(s, cards);
});

test('Heart-to-Heart rewards a cross-franchise pair with conditional healing or Momentum', () => {
  let s = start(game('CS1-060'));
  const cloudId = moveCardToHand(s, 'p1', 'CS1-031');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: cloudId }, cards);
  s = passMenu(s);
  const partyId = s.players.p1.party.find((id) => id && s.instances[id].cardId === 'CS1-031');
  const centerId = s.players.p1.center;
  const heartId = moveCardToHand(s, 'p1', 'CS1-334');
  const center = s.instances[centerId], cloud = s.instances[partyId];
  center.battlefield.currentHp -= 1000;
  const momentum = s.players.p1.resources.momentum;
  const action = getLegalActions(s, 'p1', cards).find((candidate) => candidate.type === 'ACTIVATE_ABILITY' && candidate.instanceId === heartId
    && candidate.targets?.includes(centerId) && candidate.targets.includes(partyId));
  assert.ok(action, 'cross-franchise allied targets are offered');
  assert.throws(() => dispatch(s, { ...action, playerId: 'p1', targets: [centerId, centerId] }, cards), (error) => error.code === 'ILLEGAL_TARGET');
  s = dispatch(s, { ...action, playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.equal(s.instances[centerId].battlefield.currentHp, s.instances[centerId].battlefield.maxHp, 'the one injured ally receives capped 3500 healing');
  assert.equal(s.instances[partyId].battlefield.currentHp, s.instances[partyId].battlefield.maxHp, 'the other ally remains unchanged');
  assert.equal(s.players.p1.resources.momentum, momentum + 1, 'the one-injured branch gains Momentum');
  assertStateInvariants(s, cards);

  let both = start(game('CS1-060'));
  const bothCloudId = moveCardToHand(both, 'p1', 'CS1-031');
  both = dispatch(both, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: bothCloudId }, cards);
  both = passMenu(both);
  const bothCenter = both.instances[both.players.p1.center];
  const bothParty = both.instances[both.players.p1.party.find((id) => id && both.instances[id].cardId === 'CS1-031')];
  const bothHeartId = moveCardToHand(both, 'p1', 'CS1-334');
  bothCenter.battlefield.currentHp -= 3000;
  bothParty.battlefield.currentHp -= 3000;
  const bothAction = getLegalActions(both, 'p1', cards).find((candidate) => candidate.type === 'ACTIVATE_ABILITY' && candidate.instanceId === bothHeartId);
  both = dispatch(both, { ...bothAction, playerId: 'p1' }, cards);
  both = passMenu(both);
  assert.equal(both.instances[bothCenter.instanceId].battlefield.currentHp, both.instances[bothCenter.instanceId].battlefield.maxHp - 500);
  assert.equal(both.instances[bothParty.instanceId].battlefield.currentHp, both.instances[bothParty.instanceId].battlefield.maxHp - 500);
  assert.equal(both.players.p1.resources.momentum, 5, 'healing both injured allies does not use the alternative Momentum branch');
  assertStateInvariants(both, cards);
});

test('Stocked Memories offers a revealed Ability, bottoms a hand card, and orders the remaining reveals', () => {
  let s = start(game());
  const stockedId = moveCardToHand(s, 'p1', 'CS1-285');
  const topIds = ['CS1-281', 'CS1-316', 'CS1-319', 'CS1-339'].map((id) => moveCardToTop(s, 'p1', id));
  const activation = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === stockedId);
  assert.ok(activation);
  s = dispatch(s, { ...activation, playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.equal(s.resolutionChoice.kind, 'DECK_REVEAL');
  const revealedIds = [...topIds].reverse();
  assert.deepEqual(s.resolutionChoice.revealedInstanceIds, revealedIds);
  assert.deepEqual(s.players.p1.zones.revealed, revealedIds);
  assert.deepEqual(getLegalActions(s, 'p2', cards), []);
  const chooseAbility = getLegalActions(s, 'p1', cards).find((action) => action.stage === 'ADD_ABILITY' && action.instanceId === topIds[1]);
  assert.ok(chooseAbility);
  s = dispatch(s, { ...chooseAbility, playerId: 'p1' }, cards);
  assert.equal(s.instances[topIds[1]].zone, 'hand');
  const handCardId = s.players.p1.zones.hand.find((id) => id !== topIds[1]);
  assert.ok(handCardId);
  const bottomHand = getLegalActions(s, 'p1', cards).find((action) => action.stage === 'BOTTOM_HAND' && action.instanceId === handCardId);
  s = dispatch(s, { ...bottomHand, playerId: 'p1' }, cards);
  for (const instanceId of [topIds[3], topIds[0], topIds[2]]) {
    const bottomReveal = getLegalActions(s, 'p1', cards).find((action) => action.stage === 'BOTTOM_REVEALED' && action.instanceId === instanceId);
    assert.ok(bottomReveal);
    s = dispatch(s, { ...bottomReveal, playerId: 'p1' }, cards);
  }
  assert.equal(s.resolutionChoice, null);
  assert.equal(s.pendingMenuResolution, null);
  assert.equal(s.menu, null);
  assert.deepEqual(s.players.p1.zones.revealed, []);
  assert.deepEqual(s.players.p1.zones.mainDeck.slice(-4), [handCardId, topIds[3], topIds[0], topIds[2]]);
  assert.ok(s.players.p1.zones.continue.includes(stockedId));
  assert.ok(s.log.some((event) => event.type === 'CARDS_REVEALED' && event.cardIds.join(',') === 'CS1-339,CS1-319,CS1-316,CS1-281'));
  assertStateInvariants(s, cards);
});

test('Stocked Memories can decline an Ability pickup when the reveal has no Ability', () => {
  let s = start(game());
  const stockedId = moveCardToHand(s, 'p1', 'CS1-285');
  const topIds = ['CS1-004', 'CS1-014', 'CS1-024', 'CS1-023'].map((id) => moveCardToTop(s, 'p1', id));
  const activation = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === stockedId);
  s = dispatch(s, { ...activation, playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.deepEqual(s.resolutionChoice.options, []);
  const decline = getLegalActions(s, 'p1', cards).find((action) => action.decline);
  assert.ok(decline);
  s = dispatch(s, { ...decline, playerId: 'p1' }, cards);
  const handId = s.players.p1.zones.hand[0];
  const bottomHand = getLegalActions(s, 'p1', cards).find((action) => action.stage === 'BOTTOM_HAND' && action.instanceId === handId);
  assert.ok(bottomHand);
  s = dispatch(s, { ...bottomHand, playerId: 'p1' }, cards);
  while (s.resolutionChoice?.stage === 'BOTTOM_REVEALED') {
    const action = getLegalActions(s, 'p1', cards).find((candidate) => candidate.stage === 'BOTTOM_REVEALED');
    s = dispatch(s, { ...action, playerId: 'p1' }, cards);
  }
  assert.equal(s.resolutionChoice, null);
  assert.deepEqual(s.players.p1.zones.mainDeck.slice(-5), [handId, ...[...topIds].reverse()]);
  assertStateInvariants(s, cards);
});

test('Union Cross pays a hand card, deploys a revealed Sword Wielder outside standard Add, and suppresses its Specials through the next turn', () => {
  let s = start(game('CS1-001'));
  const unionId = moveCardToHand(s, 'p1', 'CS1-290');
  const costId = s.players.p1.zones.hand.find((id) => id !== unionId);
  assert.ok(costId);
  const unionAction = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === unionId);
  assert.equal(unionAction, undefined, 'a lone Keyblade Wielder cannot activate Union Cross');
  assert.throws(() => dispatch(s, { type: 'ACTIVATE_ABILITY', playerId: 'p1', instanceId: unionId, activationCostInstanceId: costId }, cards), (error) => error.code === 'REQUIREMENT_FAILED');
  assert.ok(s.players.p1.zones.hand.includes(costId), 'a rejected activation does not pay its discard cost');

  const rikuId = moveCardToHand(s, 'p1', 'CS1-002');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: rikuId }, cards);
  s = passMenu(s);
  const topIds = ['CS1-004', 'CS1-031', 'CS1-009', 'CS1-054', 'CS1-035'].map((id) => moveCardToTop(s, 'p1', id));
  const paidCostId = moveCardToHand(s, 'p1', 'CS1-059');
  const legal = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === unionId && action.activationCostInstanceId === paidCostId);
  assert.ok(legal, 'distinct controlled Keyblade Wielders enable the activation');
  s = dispatch(s, { ...legal, playerId: 'p1' }, cards);
  assert.ok(s.players.p1.zones.continue.includes(paidCostId));
  s = passMenu(s);
  assert.equal(s.resolutionChoice.kind, 'DECK_REVEAL');
  assert.equal(s.resolutionChoice.effectKind, 'union-cross');
  const revealedIds = [...topIds].reverse();
  assert.deepEqual(s.resolutionChoice.revealedInstanceIds, revealedIds);
  assert.deepEqual(s.resolutionChoice.options.map((id) => s.instances[id].cardId), revealedIds.map((id) => s.instances[id].cardId));
  assert.ok(s.resolutionChoice.options.every((id) => (cards.find((card) => card.id === s.instances[id].cardId).subtypes ?? []).includes('Sword Wielder')));
  assert.equal(s.players.p1.turn.standardAddUsed, true);
  const addedId = topIds[0];
  const addAction = getLegalActions(s, 'p1', cards).find((action) => action.stage === 'ADD_PARTY' && action.instanceId === addedId && action.partyIndex === 4);
  assert.ok(addAction);
  s = dispatch(s, { ...addAction, playerId: 'p1' }, cards);
  const added = s.instances[addedId];
  assert.equal(s.players.p1.party[4], addedId);
  assert.equal(added.zone, 'party');
  assert.equal(added.battlefield.currentHp, cards.find((card) => card.id === added.cardId).statistics.hp);
  assert.equal(added.characterSpecialsSuppressedUntilTurn, s.turnNumber + 2);
  assert.equal(s.players.p1.turn.standardAddUsed, true, 'Union Cross did not reset or consume an extra standard Add');
  assert.equal(s.resolutionChoice.stage, 'BOTTOM_REVEALED');
  for (const instanceId of [topIds[2], topIds[1], topIds[4], topIds[3]]) {
    const bottomAction = getLegalActions(s, 'p1', cards).find((action) => action.stage === 'BOTTOM_REVEALED' && action.instanceId === instanceId);
    assert.ok(bottomAction);
    s = dispatch(s, { ...bottomAction, playerId: 'p1' }, cards);
  }
  assert.equal(s.resolutionChoice, null);
  assert.deepEqual(s.players.p1.zones.revealed, []);
  assert.deepEqual(s.players.p1.zones.mainDeck.slice(-4), [topIds[2], topIds[1], topIds[4], topIds[3]]);
  assert.ok(s.players.p1.zones.continue.includes(unionId));
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  assert.ok((s.instances[addedId].characterSpecialsSuppressedUntilTurn ?? 0) > s.turnNumber);
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p2');
  assert.equal(s.turnNumber, 3);
  assert.equal(s.instances[addedId].characterSpecialsSuppressedUntilTurn, undefined);
  assertStateInvariants(s, cards);
});

test('Dorm Study Session applies its conditional Character cost and deploys only an eligible Support or Healer with Special and attack suppression', () => {
  let s = start(game('CS1-001'));
  const dormId = moveCardToHand(s, 'p1', 'CS1-320');
  const heldCharacter = moveCardToHand(s, 'p1', 'CS1-002');
  const noCostAction = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === dormId);
  assert.ok(noCostAction, 'without a Persona User, no discard cost is required');
  assert.equal(noCostAction.activationCostInstanceId, undefined);
  assert.throws(() => dispatch(s, { ...noCostAction, playerId: 'p1', activationCostInstanceId: heldCharacter }, cards), (error) => error.code === 'ILLEGAL_ACTIVATION_COST');
  assert.ok(s.players.p1.zones.hand.includes(heldCharacter), 'illegal conditional cost is not paid');

  const topIds = ['CS1-003', 'CS1-014', 'CS1-004', 'CS1-012', 'CS1-035'].map((id) => moveCardToTop(s, 'p1', id));
  s = dispatch(s, { ...noCostAction, playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.equal(s.resolutionChoice.effectKind, 'dorm-study-session');
  const eligibleNames = s.resolutionChoice.options.map((id) => cards.find((card) => card.id === s.instances[id].cardId).name);
  assert.ok(eligibleNames.includes('Kairi'));
  assert.ok(eligibleNames.includes('Namine'));
  assert.ok(eligibleNames.includes('Donald Duck'));
  assert.ok(!eligibleNames.includes('Roxas'));
  const selected = topIds[0];
  const add = getLegalActions(s, 'p1', cards).find((action) => action.stage === 'ADD_PARTY' && action.instanceId === selected);
  assert.ok(add);
  s = dispatch(s, { ...add, playerId: 'p1' }, cards);
  assert.equal(s.instances[selected].characterSpecialsSuppressedUntilTurn, s.turnNumber + 2);
  assert.equal(s.instances[selected].cannotAttackUntilTurn, s.turnNumber + 2);
  while (s.resolutionChoice?.stage === 'BOTTOM_REVEALED') {
    const bottom = getLegalActions(s, 'p1', cards).find((action) => action.stage === 'BOTTOM_REVEALED');
    s = dispatch(s, { ...bottom, playerId: 'p1' }, cards);
  }
  s.phase = 'battle'; s.turnNumber = 2; s.activePlayerId = 'p1'; s.priorityPlayerId = 'p1';
  assert.ok(!getLegalActions(s, 'p1', cards).some((action) => action.type === 'DECLARE_ATTACK' && action.attackerInstanceId === selected));
  assert.throws(() => dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p1', attackerInstanceId: selected, targetInstanceId: s.players.p2.center }, cards), (error) => error.code === 'ATTACK_SUPPRESSED');
  s.turnNumber = 3;
  assert.ok(getLegalActions(s, 'p1', cards).some((action) => action.type === 'DECLARE_ATTACK' && action.attackerInstanceId === selected));

  let personaState = start(game('CS1-060'));
  const personaDormId = moveCardToHand(personaState, 'p1', 'CS1-320');
  const characterCost = moveCardToHand(personaState, 'p1', 'CS1-002');
  const personaAction = getLegalActions(personaState, 'p1', cards).find((action) => action.type === 'ACTIVATE_ABILITY' && action.instanceId === personaDormId && action.activationCostInstanceId === characterCost);
  assert.ok(personaAction, 'a controlled Persona User makes a Character discard mandatory');
  personaState = dispatch(personaState, { ...personaAction, playerId: 'p1' }, cards);
  assert.ok(personaState.players.p1.zones.continue.includes(characterCost));
  assert.ok(!personaState.players.p1.zones.hand.includes(characterCost));
  assertStateInvariants(personaState, cards);
});

test('Character without a registered effect program is blocked explicitly', () => {
  let s = start(game());
  const other = moveCardToHand(s, 'p1', 'CS1-283');
  assert.throws(() => dispatch(s, { type: 'ACTIVATE_ABILITY', playerId: 'p1', instanceId: other, targets: [s.players.p1.center] }, cards), (error) => error.code === 'UNIMPLEMENTED_EFFECT');
});

test('a legal opponent attack can be answered by First Aid before combat damage', () => {
  let s = start(game());
  const speedId = moveCardToHand(s, 'p1', 'CS1-433');
  const targetId = s.players.p1.center;
  const target = s.instances[targetId];
  target.battlefield.currentHp = Math.floor(target.battlefield.maxHp / 2) - 1;
  const hpBeforeResponse = target.battlefield.currentHp;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s);
  assert.equal(s.activePlayerId, 'p2');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: targetId }, cards);
  assert.equal(s.menu.priorityPlayerId, 'p1');
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  assert.equal(s.menu.priorityPlayerId, 'p2');
  s = dispatch(s, { type: 'PASS', playerId: 'p2' }, cards);
  assert.ok(getLegalActions(s, 'p1', cards).some((action) => action.type === 'ACTIVATE_SPEED' && action.instanceId === speedId));
  s = dispatch(s, { type: 'ACTIVATE_SPEED', playerId: 'p1', instanceId: speedId, targets: [targetId] }, cards);
  s = passMenu(s);
  const attack = cards.find((card) => card.id === s.instances[s.players.p2.center].cardId);
  assert.equal(s.instances[targetId].battlefield.currentHp, hpBeforeResponse + 4000 - attack.statistics.atk);
  assert.equal(s.instances[speedId].zone, 'continue');
  assertStateInvariants(s, cards);
});

test('Curaga Response heals two combat allies and Soul Sever interrupts one target before damage', () => {
  let s = start(game());
  const curagaId = moveCardToHand(s, 'p1', 'CS1-394');
  const severId = moveCardToHand(s, 'p2', 'CS1-436');
  const partyCard = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: partyCard }, cards);
  s = passMenu(s);
  // Yukari is the Healer Main; the Guard joins her as the second combat recipient.
  const centerId = s.players.p1.center;
  const guardId = s.players.p1.party[0];
  const center = s.instances[centerId], guard = s.instances[guardId];
  center.battlefield.currentHp -= 3000;
  guard.battlefield.currentHp -= 2000;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  const p1MomentumBeforeGuard = s.players.p1.resources.momentum;
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: centerId }, cards);
  s = dispatch(s, { type: 'ASSIGN_GUARDS', playerId: 'p1', guardInstanceIds: [guardId] }, cards);
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  s = dispatch(s, { type: 'PASS', playerId: 'p2' }, cards);
  const curagaAction = getLegalActions(s, 'p1', cards).find((action) => action.type === 'ACTIVATE_SPEED' && action.instanceId === curagaId && action.targets[0] === centerId && action.targets[1] === guardId);
  assert.ok(curagaAction);
  s = dispatch(s, { ...curagaAction, playerId: 'p1' }, cards);
  const pendingCuraga = s.menu.selects.find((select) => select.cardId === 'CS1-394');
  assert.ok(pendingCuraga);
  const centerBefore = center.battlefield.currentHp, guardBefore = guard.battlefield.currentHp;
  const severAction = getLegalActions(s, 'p2', cards).find((action) => action.type === 'ACTIVATE_SPEED' && action.instanceId === severId && action.targets[0] === centerId);
  assert.ok(severAction);
  const p2MomentumBeforeResponse = s.players.p2.resources.momentum;
  s = dispatch(s, { ...severAction, playerId: 'p2' }, cards);
  assert.equal(s.players.p1.resources.momentum, p1MomentumBeforeGuard - 1); // guard costs 2; Curaga activation grants 1
  assert.equal(s.players.p2.resources.momentum, p2MomentumBeforeResponse + 1);
  s = passMenu(s);
  assert.equal(s.players.p1.resources.momentum, p1MomentumBeforeGuard); // conditional reward is granted after the Menu resolves
  const attack = cards.find((card) => card.id === 'CS1-031');
  const share = Math.floor(attack.statistics.atk / 2), remainder = attack.statistics.atk % 2;
  assert.equal(s.instances[centerId].battlefield.currentHp, Math.min(center.battlefield.maxHp, centerBefore) - share - remainder);
  assert.equal(s.instances[guardId].battlefield.currentHp, Math.min(guard.battlefield.maxHp, guardBefore + 2500) - share);
  assert.equal(s.instances[curagaId].zone, 'continue');
  assert.equal(s.instances[severId].zone, 'continue');
  assert.ok(s.log.some((event) => event.type === 'HEALING_INTERRUPTED' && event.targetId === centerId));
  assertStateInvariants(s, cards);
});

test('combat guard declaration closes before responses and response priority begins with attacker', () => {
  let s = start(game());
  const partyCard = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: partyCard }, cards);
  s = passMenu(s);
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: s.players.p1.center }, cards);
  const guardId = s.players.p1.party[0];
  assert.throws(() => dispatch(s, { type: 'PASS', playerId: 'p1' }, cards), (error) => error.code === 'GUARD_WINDOW_ACTION');
  s = dispatch(s, { type: 'ASSIGN_GUARDS', playerId: 'p1', guardInstanceIds: [guardId] }, cards);
  assert.equal(s.players.p1.resources.momentum, 3);
  assert.throws(() => dispatch(s, { type: 'ASSIGN_GUARDS', playerId: 'p1', guardInstanceIds: [] }, cards), (error) => error.code === 'GUARDS_ALREADY_DECLARED');
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  assert.equal(s.menu.priorityPlayerId, 'p2');
  assert.throws(() => dispatch(s, { type: 'ASSIGN_GUARDS', playerId: 'p1', guardInstanceIds: [] }, cards), (error) => error.code === 'NO_PRIORITY');
});

test('an unregistered passive Equipment effect is not inferred from its rules text', () => {
  let s = start(game('CS1-001'));
  const targetId = s.players.p1.center;
  const gearId = s.players.p1.zones.arsenal.find((id) => s.instances[id].cardId === 'CS1-181');
  assert.ok(gearId);
  s.players.p1.zones.arsenal = s.players.p1.zones.arsenal.filter((id) => id !== gearId);
  s.instances[gearId].zone = 'attached'; s.instances[gearId].attachedTo = targetId;
  const before = s.instances[targetId].battlefield.currentHp;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: targetId }, cards);
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  s = passMenu(s);
  const attack = cards.find((card) => card.id === 'CS1-031');
  assert.equal(s.instances[targetId].battlefield.currentHp, before - attack.statistics.atk);
  assertStateInvariants(s, cards);
});

test('battle defeat revives Main as a new instance, returns Equipment, and keeps physical attack use', () => {
  let s = start(game());
  const mainId = s.players.p1.center;
  const main = s.instances[mainId];
  main.battlefield.currentHp = 1;
  main.usage.attackedThisTurn = true;
  const gearId = s.players.p1.zones.arsenal.find((id) => cards.find((card) => card.id === s.instances[id].cardId)?.type === 'Equipment');
  s.players.p1.zones.arsenal = s.players.p1.zones.arsenal.filter((id) => id !== gearId);
  s.instances[gearId].zone = 'attached'; s.instances[gearId].attachedTo = mainId;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: mainId }, cards);
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  s = passMenu(s);
  const revivedId = s.players.p1.center;
  assert.notEqual(revivedId, mainId);
  assert.equal(s.instances[mainId].zone, 'retired');
  assert.equal(s.instances[revivedId].physicalCopyId, main.physicalCopyId);
  assert.equal(s.instances[revivedId].usage.attackedThisTurn, true);
  assert.equal(s.instances[revivedId].battlefield.currentHp, s.instances[revivedId].battlefield.maxHp);
  assert.equal(s.players.p1.life, 13);
  assert.ok(s.players.p1.zones.arsenal.includes(gearId));
  assert.equal(s.players.p1.turn.freeMainAttackUsed, false);
  assertStateInvariants(s, cards);
});

test('one combat commits Main and guard defeats together before life and Momentum totals', () => {
  let s = start(game());
  const mainId = s.players.p1.center;
  s.instances[mainId].battlefield.currentHp = 1;
  const partyCard = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: partyCard }, cards);
  s = passMenu(s);
  const guardId = s.players.p1.party[0];
  s.instances[guardId].battlefield.currentHp = 1;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: mainId }, cards);
  s = dispatch(s, { type: 'ASSIGN_GUARDS', playerId: 'p1', guardInstanceIds: [guardId] }, cards);
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.equal(s.players.p1.life, 12);
  assert.equal(s.players.p2.resources.momentum, 13);
  assert.equal(s.instances[guardId].zone, 'continue');
  assert.notEqual(s.players.p1.center, mainId);
  assertStateInvariants(s, cards);
});

test('Final Form Main transformation reserves the exact base and restores it when the form is defeated', () => {
  let s = start(game('CS1-001', true, 'CS1-027'));
  const player = s.players.p1, baseId = player.center;
  player.resources.light = 3; player.resources.darkness = 2;
  const gearIds = ['CS1-181', 'CS1-183'].map((cardId) => player.zones.arsenal.find((id) => s.instances[id].cardId === cardId));
  assert.ok(gearIds.every(Boolean));
  player.zones.arsenal = player.zones.arsenal.filter((id) => !gearIds.includes(id));
  for (const id of gearIds) { s.instances[id].zone = 'attached'; s.instances[id].attachedTo = baseId; }
  const action = getLegalActions(s, 'p1', cards).find((candidate) => candidate.type === 'TRANSFORM' && candidate.formInstanceId === player.zones.arsenal.find((id) => s.instances[id].cardId === 'CS1-027') && candidate.baseInstanceId === baseId);
  assert.ok(action);
  s = dispatch(s, { ...action, playerId: 'p1' }, cards);
  const reservedId = s.players.p1.zones.baseReserve[0];
  assert.equal(s.instances[reservedId].cardId, 'CS1-001');
  s = passMenu(s);
  const formId = s.players.p1.center;
  assert.equal(s.instances[formId].cardId, 'CS1-027');
  assert.equal(s.instances[baseId].zone, 'underlay');
  assert.ok(gearIds.every((id) => s.instances[id].attachedTo === formId));
  assertStateInvariants(s, cards);
  s.instances[formId].battlefield.currentHp = 1;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: formId }, cards);
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  s = passMenu(s);
  const restoredId = s.players.p1.center;
  assert.notEqual(restoredId, reservedId);
  assert.equal(s.instances[restoredId].cardId, 'CS1-001');
  assert.equal(s.instances[restoredId].physicalCopyId, s.instances[reservedId].physicalCopyId);
  assert.equal(s.instances[formId].zone, 'continue');
  assert.equal(s.instances[baseId].zone, 'continue');
  assert.equal(s.instances[reservedId].zone, 'retired');
  assert.equal(s.players.p1.zones.baseReserve.length, 0);
  assert.ok(gearIds.every((id) => s.players.p1.zones.arsenal.includes(id)));
  assert.equal(s.players.p1.life, 13);
  assertStateInvariants(s, cards);
});

test('all eight transformation entry programs enforce their canonical requirement family', () => {
  assert.equal(supportedTransformationIds().length, 8);
  const attached = ['g1', 'g2'].map((id) => ({ instanceId: id, cardId: id, zone: 'attached', attachedTo: 'base' }));
  const cardsById = new Map([
    ['g1', { name: 'Kingdom Key', cost: { light: 1, darkness: 1 } }],
    ['g2', { name: 'Oblivion', cost: { light: 1, darkness: 3 } }],
    ['base', { franchise: 'Kingdom Hearts', subtypes: ['Sword Wielder'] }],
    ['party2', { franchise: 'Final Fantasy', subtypes: ['Dominant'] }],
    ['party3', { franchise: 'Persona', subtypes: [] }]
  ]);
  const state = { instances: { ...Object.fromEntries(attached.map((item) => [item.instanceId, item])), base: { cardId: 'base' }, party2: { cardId: 'party2' }, party3: { cardId: 'party3' } } };
  const base = { instanceId: 'base', cardId: 'base', battlefield: { currentHp: 10000, maxHp: 20000 } };
  const player = { center: 'base', party: ['party2', 'party3'], zones: { continue: Array(10).fill('continue-card') } };
  const run = (id, selectedBase = base, selectedPlayer = player, selectedState = state, cardMap = cardsById) => transformationRequirementMet(selectedState, { id }, selectedBase, selectedPlayer, cardMap);
  assert.equal(run('CS1-027'), true);
  assert.equal(run('CS1-028'), true);
  assert.equal(run('CS1-029'), true);
  assert.equal(run('CS1-030'), true);
  assert.equal(run('CS1-058'), true);
  assert.equal(run('CS1-148'), true);
  assert.equal(run('CS1-158'), true);
  assert.equal(run('CS1-166'), true);
  const costly = new Map(cardsById); costly.set('g2', { name: 'Oathkeeper', cost: { light: 1, darkness: 1 } });
  assert.equal(run('CS1-028', base, player, state, costly), false);
});

test('transformed Party defeat sends both form and underlay to Continue without a Main reserve', () => {
  let s = start(game('CS1-001', true, 'CS1-027'));
  const partyBaseId = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: partyBaseId }, cards);
  s = passMenu(s);
  const player = s.players.p1;
  player.resources.light = 3; player.resources.darkness = 2;
  const gearIds = ['CS1-181', 'CS1-183'].map((cardId) => player.zones.arsenal.find((id) => s.instances[id].cardId === cardId));
  player.zones.arsenal = player.zones.arsenal.filter((id) => !gearIds.includes(id));
  for (const id of gearIds) { s.instances[id].zone = 'attached'; s.instances[id].attachedTo = partyBaseId; }
  const action = getLegalActions(s, 'p1', cards).find((candidate) => candidate.type === 'TRANSFORM' && candidate.baseInstanceId === partyBaseId);
  assert.ok(action);
  assert.equal(action.reserveRequired, false);
  s = dispatch(s, { ...action, playerId: 'p1' }, cards);
  s = passMenu(s);
  const formId = s.players.p1.party[0];
  assert.equal(s.players.p1.zones.baseReserve.length, 0);
  assert.equal(s.instances[partyBaseId].zone, 'underlay');
  s.instances[formId].battlefield.currentHp = 1;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  s = advancePhase(s, 'p2');
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: formId }, cards);
  s = dispatch(s, { type: 'BEGIN_COMBAT_RESPONSES', playerId: 'p1' }, cards);
  s = passMenu(s);
  assert.equal(s.instances[formId].zone, 'continue');
  assert.equal(s.instances[partyBaseId].zone, 'continue');
  assert.equal(s.players.p1.party[0], null);
  assert.ok(gearIds.every((id) => s.players.p1.zones.arsenal.includes(id)));
  assert.equal(s.players.p1.life, 14);
  assertStateInvariants(s, cards);
});

test('the attacking player pays two Momentum for each extra Chain participant', () => {
  let s = start(game());
  const charId = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: charId }, cards);
  s = passMenu(s);
  s.players.p1.resources.momentum = 1;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s);
  s = advancePhase(s, 'p2');
  const extraCard = s.players.p2.zones.hand.find((id) => cards.find((c) => c.id === s.instances[id].cardId).type === 'Character');
  assert.ok(extraCard);
  const extra = s.instances[extraCard], record = cards.find((c) => c.id === extra.cardId);
  s.players.p2.zones.hand = s.players.p2.zones.hand.filter((id) => id !== extraCard);
  s.players.p2.party[0] = extraCard; extra.zone = 'party'; extra.battlefield = { currentHp: record.statistics.hp, maxHp: record.statistics.hp, position: 'party-0' };
  s.players.p2.resources.momentum = 1;
  assert.throws(() => dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: s.players.p1.center, chainInstanceIds: [extraCard] }, cards), (error) => error.code === 'INSUFFICIENT_RESOURCE');
});

test('Equipment compatibility and resource cost are checked before opening the Menu', () => {
  let s = start(game('CS1-001'));
  const equipmentId = s.players.p1.zones.arsenal.find((id) => s.instances[id].cardId === 'CS1-181');
  assert.ok(equipmentId);
  assert.throws(() => dispatch(s, { type: 'ATTACH_EQUIPMENT', playerId: 'p1', equipmentInstanceId: equipmentId, hostInstanceId: s.players.p1.center }, cards), (error) => error.code === 'INSUFFICIENT_RESOURCE');
  const swordHost = s.players.p2.center;
  assert.throws(() => dispatch(s, { type: 'ATTACH_EQUIPMENT', playerId: 'p1', equipmentInstanceId: equipmentId, hostInstanceId: swordHost }, cards), RuleError);
});

test('turn start grants five Momentum, one Light and one Darkness, then draws', () => {
  let s = start(game());
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p1');
  const before = s.players.p1.zones.hand.length;
  for (let i = 0; i < 3; i += 1) s = advancePhase(s, 'p2');
  assert.equal(s.activePlayerId, 'p1');
  assert.deepEqual(s.players.p1.resources, { momentum: 10, light: 1, darkness: 1 });
  assert.equal(s.players.p1.zones.hand.length, 6);
  assert.equal(before, 5);
  assertStateInvariants(s, cards);
});
