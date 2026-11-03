import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCards, allCards } from '../src/data/cards.js';
import { createInitialState, dispatch, getLegalActions, assertStateInvariants, RuleError } from '../src/engine/game.js';
import { supportedTransformationIds, transformationRequirementMet } from '../src/engine/transformations.js';

await loadCards();
const cards = allCards();
const ids = new Set(cards.map((card) => card.id));
function deck(starter, duplicateStarter = false, transformationId = null) {
  const required = [starter, 'CS1-059', 'CS1-060', 'CS1-281', 'CS1-282', 'CS1-316', 'CS1-319', 'CS1-433'];
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
  return createInitialState({
    players: [
      { id: 'p1', name: 'Player One', deck: deck(p1Starter, duplicateStarter, transformationId), startingMainId: p1Starter },
      { id: 'p2', name: 'Player Two', deck: deck('CS1-031'), startingMainId: 'CS1-031' }
    ], firstPlayerId: 'p1', chooserId: 'p2', seed: 42, cards
  });
}
function start(g) {
  let s = dispatch(g, { type: 'MULLIGAN', playerId: 'p1', instanceIds: [] }, cards);
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

test('initialization validates registration, chooses a starting Main, and deals five cards', () => {
  const s = game();
  assert.equal(s.players.p1.life, 15);
  assert.deepEqual(s.players.p1.resources, { momentum: 5, light: 0, darkness: 0 });
  assert.equal(s.players.p1.zones.hand.length, 5);
  assert.equal(s.players.p1.center && s.instances[s.players.p1.center].cardId, 'CS1-060');
  assert.equal(s.instances[s.players.p1.center].battlefield.maxHp, cards.find((x) => x.id === 'CS1-060').statistics.hp + 13000);
  assertStateInvariants(s, cards);
});

test('ordered mulligans preserve card count and open the first Main Phase', () => {
  let s = game();
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

test('Character without a registered effect program is blocked explicitly', () => {
  let s = start(game());
  const other = moveCardToHand(s, 'p1', 'CS1-282');
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
