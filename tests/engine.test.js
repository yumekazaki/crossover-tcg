import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCards, allCards } from '../src/data/cards.js';
import { createInitialState, dispatch, getLegalActions, assertStateInvariants, RuleError } from '../src/engine/game.js';

await loadCards();
const cards = allCards();
const ids = new Set(cards.map((card) => card.id));
function deck(starter) {
  const required = [starter, 'CS1-060', 'CS1-281', 'CS1-282', 'CS1-433'];
  const extras = cards.filter((card) => card.type === 'Character' && !card.transformation).map((card) => card.id);
  const mainIds = [...new Set([...required, ...extras])].slice(0, 40);
  assert.equal(mainIds.length, 40);
  const equipmentIds = cards.filter((card) => card.type === 'Equipment').slice(0, 20).map((card) => card.id);
  assert.equal(new Set(mainIds).size, 40);
  return { mainIds, equipmentIds };
}
function game(p1Starter = 'CS1-060') {
  return createInitialState({
    players: [
      { id: 'p1', name: 'Player One', deck: deck(p1Starter), startingMainId: p1Starter },
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
  for (const type of ['ADVANCE_PHASE', 'ADVANCE_PHASE', 'ADVANCE_PHASE']) s = dispatch(s, { type, playerId: s.activePlayerId }, cards);
  assert.equal(s.activePlayerId, 'p2');
  s = dispatch(s, { type: 'ADVANCE_PHASE', playerId: 'p2' }, cards);
  s = dispatch(s, { type: 'DECLARE_ATTACK', playerId: 'p2', attackerInstanceId: s.players.p2.center, targetInstanceId: targetId }, cards);
  assert.ok(getLegalActions(s, 'p1', cards).some((action) => action.type === 'ACTIVATE_SPEED' && action.instanceId === speedId));
  s = dispatch(s, { type: 'ACTIVATE_SPEED', playerId: 'p1', instanceId: speedId, targets: [targetId] }, cards);
  s = passMenu(s);
  const attack = cards.find((card) => card.id === s.instances[s.players.p2.center].cardId);
  assert.equal(s.instances[targetId].battlefield.currentHp, hpBeforeResponse + 4000 - attack.statistics.atk);
  assert.equal(s.instances[speedId].zone, 'continue');
  assertStateInvariants(s, cards);
});

test('the attacking player pays two Momentum for each extra Chain participant', () => {
  let s = start(game());
  const charId = moveCardToHand(s, 'p1', 'CS1-001');
  s = dispatch(s, { type: 'ADD_TO_PARTY', playerId: 'p1', instanceId: charId }, cards);
  s = passMenu(s);
  s.players.p1.resources.momentum = 1;
  for (const type of ['ADVANCE_PHASE', 'ADVANCE_PHASE', 'ADVANCE_PHASE']) s = dispatch(s, { type, playerId: s.activePlayerId }, cards);
  s = dispatch(s, { type: 'ADVANCE_PHASE', playerId: 'p2' }, cards);
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
  for (const type of ['ADVANCE_PHASE', 'ADVANCE_PHASE', 'ADVANCE_PHASE']) s = dispatch(s, { type, playerId: 'p1' }, cards);
  const before = s.players.p1.zones.hand.length;
  for (const type of ['ADVANCE_PHASE', 'ADVANCE_PHASE', 'ADVANCE_PHASE']) s = dispatch(s, { type, playerId: 'p2' }, cards);
  assert.equal(s.activePlayerId, 'p1');
  assert.deepEqual(s.players.p1.resources, { momentum: 10, light: 1, darkness: 1 });
  assert.equal(s.players.p1.zones.hand.length, 6);
  assert.equal(before, 5);
  assertStateInvariants(s, cards);
});
