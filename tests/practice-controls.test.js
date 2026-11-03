import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCards, allCards } from '../src/data/cards.js';
import { createInitialState, dispatch, getLegalActions, assertStateInvariants } from '../src/engine/game.js';

await loadCards();
const cards = allCards();
const sampleDecks = JSON.parse(await readFile(new URL('../data/source/decks.json', import.meta.url), 'utf8'));

function activePracticeMatch(sandboxMode) {
  const registrations = [sampleDecks[0], sampleDecks[1]];
  let state = createInitialState({
    players: registrations.map((deck, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}`, deck: { mainIds: deck.main, equipmentIds: deck.arsenal } })),
    chooserId: 'p1', seed: 9, cards, sandboxMode
  });
  state = dispatch(state, { type: 'CHOOSE_FIRST_PLAYER', playerId: 'p1', firstPlayerId: 'p1' }, cards);
  for (const playerId of state.startingMainOrder) {
    const deck = registrations[Number(playerId.slice(1)) - 1];
    const action = getLegalActions(state, playerId, cards).find((item) => item.type === 'SELECT_STARTING_MAIN' && state.instances[item.instanceId].cardId === deck.starting_main);
    assert.ok(action, `expected a Starting Main for ${playerId}`);
    state = dispatch(state, { ...action, playerId }, cards);
  }
  for (const playerId of state.mulliganOrder) state = dispatch(state, { type: 'MULLIGAN', playerId, instanceIds: [] }, cards);
  assert.equal(state.status, 'active');
  return state;
}

test('manual resource tools are opt-in and update only through the practice reducer', () => {
  let state = activePracticeMatch(true);
  for (const resource of ['light', 'darkness', 'momentum']) {
    const before = state.players.p1.resources[resource];
    state = dispatch(state, { type: 'PRACTICE_ADJUST_RESOURCE', playerId: 'p1', resource, delta: 1 }, cards);
    assert.equal(state.players.p1.resources[resource], before + 1);
  }
  state = dispatch(state, { type: 'PRACTICE_ADJUST_RESOURCE', playerId: 'p1', resource: 'light', delta: -1 }, cards);
  assert.equal(state.players.p1.resources.light, 0);
  assert.equal(state.log.at(-1).type, 'PRACTICE_RESOURCE_ADJUSTED');
  assert.equal(assertStateInvariants(state, cards), true);
});

test('manual resource tools reject disabled matches, invalid deltas, underflow, and open response windows', () => {
  const action = { type: 'PRACTICE_ADJUST_RESOURCE', playerId: 'p1', resource: 'momentum', delta: 1 };
  assert.throws(() => dispatch(activePracticeMatch(false), action, cards), (error) => error.code === 'SANDBOX_TOOLS_DISABLED');
  let state = activePracticeMatch(true);
  assert.throws(() => dispatch(state, { ...action, delta: 2 }, cards), (error) => error.code === 'SANDBOX_DELTA');
  state.players.p1.resources.light = 0;
  assert.throws(() => dispatch(state, { ...action, resource: 'light', delta: -1 }, cards), (error) => error.code === 'SANDBOX_RESOURCE_RANGE');
  state.menu = { priorityPlayerId: 'p1' };
  assert.throws(() => dispatch(state, action, cards), (error) => error.code === 'SANDBOX_RESOURCE_WINDOW');
});

