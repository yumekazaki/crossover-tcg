import { loadCards, allCards, validateDeck, getArtwork } from './data/cards.js?v=20261103-interactionfix3';
import { createCardBrowser } from './ui/card-browser.js?v=20261103-interactionfix3';
import { renderBattlefield } from './ui/battlefield.js?v=20261103-interactionfix3';
import { createInitialState, dispatch, getLegalActions, assertStateInvariants } from './engine/game.js?v=20261103-interactionfix3';
import { implementedEffectIds } from './engine/effects.js?v=20261103-interactionfix3';
import { supportedTransformationIds } from './engine/transformations.js?v=20261103-interactionfix3';

const $ = (id) => document.getElementById(id);
let cards = [];
let samples = [];
let saved = [];
let activeDeckId = null;
let panel;
let match = null;
let selectedInstanceId = null;
const previousResourceValues = new Map();

const deckCopy = (deck) => ({ mainIds: deck.mainIds.slice(), equipmentIds: deck.equipmentIds.slice() });
const deckCheck = (deck) => validateDeck(deck);
function persist() { localStorage.setItem('crossover-tcg-decks-v1', JSON.stringify(saved)); }
function currentDeck() { return saved.find((x) => x.id === activeDeckId) || null; }
function syncDeckUI() {
  const select = $('deck-select'); select.replaceChildren();
  for (const deck of saved) { const option = document.createElement('option'); option.value = deck.id; option.textContent = `${deck.name}${deckCheck(deck).valid ? '' : ' · draft'}`; select.append(option); }
  if (!currentDeck() && saved.length) activeDeckId = saved[0].id;
  select.value = activeDeckId || '';
  const deck = currentDeck(); $('deck-name').value = deck?.name || '';
  panel?.update({ deck: deck ? deckCopy(deck) : { mainIds: [], equipmentIds: [] }, validation: deck ? deckCheck(deck) : null });
  updateMatchDeckChoices();
}
function updateMatchDeckChoices() {
  for (const id of ['p1-deck', 'p2-deck']) {
    const select = $(id), old = select.value; select.replaceChildren();
    for (const deck of saved) {
      const option = document.createElement('option'); option.value = deck.id;
      const verdict = deckCheck(deck).valid ? 'ready' : 'invalid';
      option.textContent = `${deck.name} · ${verdict}`; option.disabled = !deckCheck(deck).valid; select.append(option);
    }
    if ([...select.options].some((option) => option.value === old && !option.disabled)) select.value = old;
    else select.value = saved.find((deck) => deckCheck(deck).valid)?.id || '';
  }
}
function initSavedDecks() {
  try { saved = JSON.parse(localStorage.getItem('crossover-tcg-decks-v1') || '[]'); } catch { saved = []; }
  if (!Array.isArray(saved) || saved.some((x) => typeof x?.id !== 'string' || !Array.isArray(x.mainIds) || !Array.isArray(x.equipmentIds))) saved = [];
  const byId = new Map(cards.map((card) => [card.id, card]));
  const existingSampleIds = new Set(saved.filter((deck) => deck.sample).map((deck) => deck.id));
  for (const sample of samples) {
    const sampleId = `sample-${sample.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
    if (!existingSampleIds.has(sampleId)) saved.push({ id: sampleId, name: sample.name, mainIds: sample.main, equipmentIds: sample.arsenal, startingMainId: sample.starting_main, sample: true });
  }
  saved = saved.filter((deck) => deck.mainIds.every((id) => byId.has(id)) && deck.equipmentIds.every((id) => byId.has(id)));
  activeDeckId = saved.find((deck) => deck.name === 'Crossworld Swords')?.id || saved[0]?.id || null;
  persist();
}
function addOrRemove(cardId, section, operation) {
  const deck = currentDeck(); if (!deck) throw new Error('Select or create a deck first.');
  const next = deckCopy(deck); const key = section === 'equipment' ? 'equipmentIds' : 'mainIds';
  if (operation === 'add') next[key].push(cardId);
  else { const index = next[key].lastIndexOf(cardId); if (index >= 0) next[key].splice(index, 1); }
  deck.mainIds = next.mainIds; deck.equipmentIds = next.equipmentIds; deck.sample = false;
  persist(); syncDeckUI(); return { deck: deckCopy(deck), validation: deckCheck(deck) };
}
function mountBrowser() {
  panel = createCardBrowser({
    cards, deck: deckCopy(currentDeck() || { mainIds: [], equipmentIds: [] }), validation: currentDeck() ? deckCheck(currentDeck()) : null,
    onAdd: (cardId, section) => addOrRemove(cardId, section, 'add'),
    onRemove: (cardId, section) => addOrRemove(cardId, section, 'remove')
  });
  panel.addEventListener('browse-cards', () => showView('library', 'cards'));
  $('card-browser').replaceChildren(panel);
}
function saveDeck() {
  const deck = currentDeck(); if (!deck) return;
  const name = $('deck-name').value.trim(); if (!name) { alert('Enter a deck name.'); return; }
  deck.name = name; deck.sample = false; persist(); syncDeckUI();
}
function newDeck(copy = null) {
  const source = copy || { mainIds: [], equipmentIds: [] };
  const deck = { id: `local-${crypto.randomUUID()}`, name: copy ? `${copy.name} Copy` : 'New Deck', mainIds: source.mainIds.slice(), equipmentIds: source.equipmentIds.slice(), sample: false };
  saved.push(deck); activeDeckId = deck.id; persist(); syncDeckUI();
}
function exportDeck() {
  const deck = currentDeck(); if (!deck) return;
  const blob = new Blob([JSON.stringify({ format: 'crossover-tcg-deck-v1', name: deck.name, mainIds: deck.mainIds, equipmentIds: deck.equipmentIds, validation: deckCheck(deck) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${deck.name.replace(/[^a-z0-9_-]+/gi, '-')}.json`; a.click(); URL.revokeObjectURL(url);
}
async function importDeck(file) {
  const data = JSON.parse(await file.text());
  const mainIds = data.mainIds || data.main, equipmentIds = data.equipmentIds || data.arsenal;
  if (!Array.isArray(mainIds) || !Array.isArray(equipmentIds)) throw new Error('Deck file needs mainIds and equipmentIds arrays.');
  const deck = { id: `import-${crypto.randomUUID()}`, name: String(data.name || 'Imported Deck'), mainIds: mainIds.slice(), equipmentIds: equipmentIds.slice(), sample: false };
  const result = deckCheck(deck); saved.push(deck); activeDeckId = deck.id; persist(); syncDeckUI();
  $('match-notice').textContent = result.valid ? 'Deck imported and validated.' : `Deck imported as a draft: ${result.errors.join(' ')}`;
}
function startMatch() {
  const p1 = saved.find((deck) => deck.id === $('p1-deck').value), p2 = saved.find((deck) => deck.id === $('p2-deck').value);
  if (!p1 || !p2) { $('match-notice').textContent = 'Choose two saved decks that pass validation.'; return; }
  for (const deck of [p1, p2]) { const check = deckCheck(deck); if (!check.valid) { $('match-notice').textContent = `${deck.name}: ${check.errors.join(' ')}`; return; } }
  const chooserId = Math.random() < 0.5 ? 'p1' : 'p2';
  const state = createInitialState({
    players: [{ id: 'p1', name: 'Player One', deck: { mainIds: p1.mainIds, equipmentIds: p1.equipmentIds } },
      { id: 'p2', name: 'Player Two', deck: { mainIds: p2.mainIds, equipmentIds: p2.equipmentIds } }],
    chooserId, seed: Math.floor(Math.random() * 0xffffffff), cards,
    sandboxMode: $('practice-tools').checked
  });
  selectedInstanceId = null; previousResourceValues.clear();
  match = state; $('match-board').hidden = false; $('reset-match').disabled = false; $('practice-tools').disabled = true;
  $('match-notice').textContent = `A random choice selected ${chooserId === 'p1' ? 'Player One' : 'Player Two'} to choose who goes first. Make that choice below. Local shared-device practice only.${state.sandboxMode ? ' Manual resource tools are enabled and changes will be logged.' : ''}`;
  renderMatch();
}
function cardName(instanceId) { const instance = match.instances[instanceId]; return cards.find((card) => card.id === instance?.cardId)?.name || instance?.cardId || 'Empty'; }
function safeDispatch(action) {
  try {
    match = dispatch(match, action, cards);
    assertStateInvariants(match, cards);
    if (action.type !== 'PRACTICE_ADJUST_RESOURCE') selectedInstanceId = null;
    if (match.phase === 'starting-main-selection') $('match-notice').textContent = `${match.players[match.startingMainOrder[match.startingMainIndex]].name} selects their Starting Main now.`;
    else if (match.phase === 'mulligan') $('match-notice').textContent = `Starting Mains are set. ${match.players[match.mulliganOrder[match.mulliganIndex]].name} may return up to five opening cards.`;
    else if (match.phase === 'main' && action.type === 'MULLIGAN') $('match-notice').textContent = 'Setup complete. The first player begins their Main Phase.';
    renderMatch();
    if (action.type === 'DECLARE_ATTACK' && action.targetInstanceId) {
      const target = [...$('match-board').querySelectorAll('[data-instance-id]')].find((node) => node.dataset.instanceId === action.targetInstanceId);
      target?.classList.add('is-hit-animation');
      if (target) setTimeout(() => target.classList.remove('is-hit-animation'), 420);
    }
  }
  catch (error) { const notice = $('match-notice'); notice.textContent = `${error.code || 'ERROR'}: ${error.message}`; notice.classList.add('is-error'); setTimeout(() => notice.classList.remove('is-error'), 4000); }
}
function create(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function showCard(card) {
  const content = $('dialog-content'), art = getArtwork(card); content.className = 'dialog-content'; content.replaceChildren();
  content.append(create('p', 'eyebrow', `${card.id} · ${card.franchise} · ${card.game}`));
  content.append(create('h2', '', card.name));
  content.append(create('p', 'dialog-meta', `${card.type} · ${card.rarity} · ${card.subtypes.join(' / ') || 'No subtypes'}`));
  const artFrame = create('div', `dialog-art${art.src ? ' has-image' : ''}`);
  if (art.src) {
    const image = create('img', '', undefined);
    image.src = art.src; image.alt = art.label; image.loading = 'lazy'; image.decoding = 'async';
    artFrame.append(image);
  } else {
    artFrame.setAttribute('role', 'img'); artFrame.setAttribute('aria-label', `No approved artwork for ${card.name}.`);
    artFrame.append(create('span', 'dialog-art-mark', card.type === 'Character' ? '◇' : card.type === 'Equipment' ? '⚔' : card.type === 'Finisher' ? '✦' : '✧'));
    artFrame.append(create('strong', '', card.name), create('small', '', 'Artwork pending approval'));
  }
  content.append(artFrame);
  content.append(create('p', 'dialog-effect', card.effect_text));
  content.append(create('p', '', `Cost: ${card.cost.light} Light · ${card.cost.darkness} Darkness · ${card.cost.momentum} Momentum`));
  content.append(create('p', 'dialog-art-credit', art.placeholder
    ? `${art.label}. No locally attached image has approved display rights.` : `Artwork credit: ${art.credit || 'not recorded'}`));
  const supportedForm = supportedTransformationIds().includes(card.id);
  const effectStatus = implementedEffectIds().includes(card.id) ? 'implemented effect template'
    : supportedForm ? 'transformation entry and base requirements are supported; printed form effects are still pending'
      : card.type === 'Equipment' ? 'attachment procedure is supported; printed Equipment effects are not implemented'
        : 'effect not yet implemented; actions using it are disabled';
  content.append(create('p', '', `Engine status: ${effectStatus}.`));
  if (art.sourceUrl) { const link = create('a', '', 'Recorded source provenance'); link.href = art.sourceUrl; link.target = '_blank'; link.rel = 'noreferrer'; content.append(link); }
  $('card-dialog').showModal();
}
function actionButton(label, callback, klass = '') { const b = create('button', `action-button ${klass}`, label); b.type = 'button'; b.addEventListener('click', callback); return b; }
function actionUsesInstance(action, instanceId) {
  if (!instanceId) return false;
  for (const key of ['instanceId', 'equipmentInstanceId', 'hostInstanceId', 'attackerInstanceId', 'targetInstanceId', 'baseInstanceId', 'formInstanceId', 'partyInstanceId', 'activationCostInstanceId', 'bladeInstanceId']) {
    if (action[key] === instanceId) return true;
  }
  return ['instanceIds', 'targets', 'targetOptions', 'requirementInstanceIds', 'availableChainIds', 'eligibleInstanceIds'].some((key) => action[key]?.includes(instanceId));
}
const alwaysAvailableActionTypes = new Set(['PASS', 'PASS_PRIORITY', 'MULLIGAN', 'RESOLVE_CHOICE', 'CHOOSE_FIRST_PLAYER', 'SELECT_STARTING_MAIN', 'ASSIGN_GUARDS', 'BEGIN_COMBAT_RESPONSES']);
function renderActions(allActions, actorId, container, selectedId = null) {
  container.replaceChildren();
  const actions = selectedId
    ? allActions.filter((action) => alwaysAvailableActionTypes.has(action.type) || actionUsesInstance(action, selectedId))
    : allActions;
  if (selectedId && actions.length === 0) {
    const empty = create('p', 'action-empty', 'No legal actions are available for this card right now.');
    container.append(empty); return;
  }
  for (const action of actions) {
    if (action.type === 'MULLIGAN') {
      const wrap = create('div', 'guard-choice');
      wrap.append(create('span', '', 'Choose up to five cards to return and redraw.'));
      const checks = [];
      for (const id of match.players[actorId].zones.hand) {
        const card = cards.find((item) => item.id === match.instances[id].cardId);
        const label = create('label', 'guard-check'), input = document.createElement('input');
        input.type = 'checkbox'; input.value = id;
        label.append(input, create('span', '', `${card.name} · ${card.type}`));
        checks.push(input); wrap.append(label);
      }
      for (const input of checks) input.addEventListener('change', () => {
        const chosen = checks.filter((check) => check.checked);
        if (chosen.length > action.max) input.checked = false;
      });
      wrap.append(actionButton('Return selected cards and redraw', () => safeDispatch({ type: 'MULLIGAN', playerId: actorId, instanceIds: checks.filter((check) => check.checked).map((check) => check.value) }), 'pass'));
      container.append(wrap); continue;
    }
    if (action.type === 'RESOLVE_CHOICE') {
      const label = action.choiceKind === 'ASHLEY_REPLACEMENT'
        ? action.decline ? 'Return Party Member without replacing it' : `Reveal ${cardName(action.instanceId)} and add it to Party`
        : action.choiceKind === 'DECK_REVEAL'
        ? action.stage === 'GRACE_RESOURCE' ? `Gain 1 ${action.resourceChoice === 'light' ? 'Light' : 'Darkness'}` : action.stage === 'GRACE_ALLY' ? `Choose ${cardName(action.instanceId)} · ${action.subtype}` : action.decline ? ['union-cross', 'dorm-study-session'].includes(action.effectKind) ? 'Skip Character placement' : 'Skip adding an Ability' : action.stage === 'ADD_ABILITY' ? `Add ${cardName(action.instanceId)} to hand` : action.stage === 'ADD_PARTY' ? `Add ${cardName(action.instanceId)} to Party ${action.partyIndex + 1}` : action.stage === 'BOTTOM_HAND' ? `Put ${cardName(action.instanceId)} from hand on deck bottom` : `Put ${cardName(action.instanceId)} on deck bottom next`
        : `Discard ${cardName(action.instanceId)} to Continue?`;
      container.append(actionButton(label, () => safeDispatch({ ...action, playerId: actorId }), action.decline ? 'pass' : ''));
      continue;
    }
    if (action.type === 'CHOOSE_FIRST_PLAYER') { container.append(actionButton(`Choose ${match.players[action.firstPlayerId].name} to go first`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'SELECT_STARTING_MAIN') { container.append(actionButton(`Choose ${cardName(action.instanceId)} as Starting Main`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'PASS') { container.append(actionButton('Pass response', () => safeDispatch({ type: 'PASS', playerId: actorId }), 'pass phase-primary')); continue; }
    if (action.type === 'PASS_PRIORITY') { const next = match.phase === 'main' ? 'Battle' : match.phase === 'battle' ? 'End' : 'next turn'; container.append(actionButton(match.phasePasses ? `Confirm pass · advance to ${next}` : 'Pass priority', () => safeDispatch({ type: 'PASS_PRIORITY', playerId: actorId }), 'pass phase-primary')); continue; }
    if (action.type === 'ASSIGN_GUARDS') {
      const wrap = create('div', 'guard-choice'); wrap.append(create('span', '', 'Choose Party Members to guard (2 Momentum each)'));
      const checks = [];
      for (const id of action.eligibleInstanceIds) { const label = create('label', 'guard-check'), input = document.createElement('input'); input.type = 'checkbox'; input.value = id; label.append(input, create('span', '', cardName(id))); checks.push(input); wrap.append(label); }
      for (const input of checks) input.addEventListener('change', () => { const selected = checks.filter((check) => check.checked).length; if (selected > action.maxCount) input.checked = false; const full = checks.filter((check) => check.checked).length >= action.maxCount; for (const check of checks) check.disabled = full && !check.checked; });
      wrap.append(actionButton('Assign selected guards', () => safeDispatch({ type: action.type, playerId: actorId, guardInstanceIds: checks.filter((x) => x.checked).map((x) => x.value) }))); container.append(wrap); continue;
    }
    if (action.type === 'BEGIN_COMBAT_RESPONSES') { container.append(actionButton('Confirm guards and begin responses', () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'ADD_TO_PARTY') { container.append(actionButton(`Add ${cardName(action.instanceId)} to Party`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'SWITCH_CENTER') { container.append(actionButton(`Switch Center → ${cardName(action.partyInstanceId)}`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'PARTY_SWAP') { container.append(actionButton(`Party Swap → ${action.instanceIds.map(cardName).join(' + ')}`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'ACTIVATE_SPECIAL') { const name = cardName(action.instanceId), cost = action.activationCostInstanceId ? ` · discard ${cardName(action.activationCostInstanceId)}` : ''; const targets = action.targets.map(cardName).join(' + '); const effect = name === 'Axel' ? `damage ${targets || 'no targets'}` : name === 'Grace Ashcroft' ? 'reveal top five' : `return ${targets}`; container.append(actionButton(`Activate ${name} Special${cost} · ${effect}`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'TRANSFORM') { container.append(actionButton(`Transform ${cardName(action.baseInstanceId)} → ${cardName(action.formInstanceId)}`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'ATTACH_EQUIPMENT') { const gear = cardName(action.equipmentInstanceId), host = cardName(action.hostInstanceId); container.append(actionButton(`Attach ${gear} → ${host}`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'ACTIVATE_ABILITY') {
      if (action.resourceChoice) { container.append(actionButton(`Activate ${cardName(action.instanceId)} · gain 2 ${action.resourceChoice} with ${action.requirementInstanceIds.map(cardName).join(' + ')}`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
      if (action.abilityKind === 'armiger-preparation') { container.append(actionButton(`Activate ${cardName(action.instanceId)} · gain 1 Light + 1 Darkness`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
      if (action.abilityKind === 'stocked-memories') { container.append(actionButton(`Activate ${cardName(action.instanceId)} · reveal the top four cards`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
      if (action.abilityKind === 'union-cross') { container.append(actionButton(`Activate ${cardName(action.instanceId)} · discard ${cardName(action.activationCostInstanceId)} · reveal top five`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
      if (action.abilityKind === 'dorm-study-session') { container.append(actionButton(`Activate ${cardName(action.instanceId)}${action.activationCostInstanceId ? ` · discard ${cardName(action.activationCostInstanceId)}` : ''} · reveal top five`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
      if (action.bladeInstanceId) { container.append(actionButton(`Activate ${cardName(action.instanceId)} · reveal ${cardName(action.bladeInstanceId)}, discard ${cardName(action.activationCostInstanceId)}`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
      if (action.activationCostInstanceId) { container.append(actionButton(`Activate ${cardName(action.instanceId)} · put ${cardName(action.activationCostInstanceId)} on deck bottom`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
      for (const targetId of action.targetOptions || []) container.append(actionButton(`Activate ${cardName(action.instanceId)} → ${cardName(targetId)}`, () => safeDispatch({ ...action, playerId: actorId, targets: [targetId] }))); continue;
    }
    if (action.type === 'ACTIVATE_SPEED') { container.append(actionButton(`Respond with ${cardName(action.instanceId)} → ${(action.targets ?? []).map(cardName).join(' + ')}`, () => safeDispatch({ ...action, playerId: actorId }), 'pass')); continue; }
    if (action.type === 'DECLARE_ATTACK') {
      const label = `${cardName(action.attackerInstanceId)} attacks ${cardName(action.targetInstanceId)}`;
      container.append(actionButton(label, () => safeDispatch({ ...action, playerId: actorId, chainInstanceIds: [] })));
      const maxExtras = Math.min(action.availableChainIds.length, Math.floor(match.players[actorId].resources.momentum / 2));
      for (let count = 1; count <= maxExtras; count += 1) {
        const extraIds = action.availableChainIds.slice(0, count);
        container.append(actionButton(`Chain ${label} with ${extraIds.map(cardName).join(' + ')}`, () => safeDispatch({ ...action, playerId: actorId, chainInstanceIds: extraIds })));
      }
    }
  }
}
function logLabel(entry) {
  const p = entry.playerId ? `${match.players[entry.playerId]?.name || entry.playerId}: ` : '';
  const resourceChange = entry.type === 'PRACTICE_RESOURCE_ADJUSTED' ? ` · ${entry.resource} ${entry.delta > 0 ? '+' : '−'}${Math.abs(entry.delta)}` : '';
  return `${p}${entry.type.replaceAll('_', ' ').toLocaleLowerCase()}${entry.cardId ? ` · ${cards.find((x) => x.id === entry.cardId)?.name || entry.cardId}` : ''}${resourceChange}${entry.amount != null ? ` · ${entry.amount.toLocaleString()}` : ''}`;
}
function phaseMessage(state) {
  if (state.status === 'finished') return state.winnerId ? `${state.players[state.winnerId].name} wins` : 'The match is a draw';
  if (state.resolutionChoice) return state.resolutionChoice.prompt;
  if (state.menu) return `Response Menu · ${state.players[state.menu.priorityPlayerId].name} has priority · ${state.menu.consecutivePasses}/2 passes`;
  if (state.phase === 'first-player-choice') return `${state.players[state.firstPlayerChooserId].name} chooses who goes first.`;
  if (state.phase === 'starting-main-selection') return `${state.players[state.startingMainOrder[state.startingMainIndex]].name} chooses a Starting Main.`;
  if (state.phase === 'mulligan') return `${state.players[state.mulliganOrder[state.mulliganIndex]].name} may redraw up to five cards.`;
  const priority = state.players[state.priorityPlayerId]?.name || 'A player';
  if (state.phasePasses) return `One pass recorded. ${priority} must pass to advance the phase.`;
  return `${priority} has phase priority. Play an action or pass.`;
}
function renderPhaseControls(state, actorId, legalActions) {
  const section = create('section', 'phase-controls');
  const heading = create('div', 'phase-controls__heading');
  const headingCopy = create('div'); headingCopy.append(create('p', 'eyebrow', 'TURN FLOW'), create('h3', '', state.menu ? 'Response window' : 'Phase & priority'));
  heading.append(headingCopy);
  const phaseName = state.phase.replaceAll('-', ' ');
  heading.append(create('span', 'phase-controls__current', phaseName.toUpperCase()));
  section.append(heading, create('p', 'phase-controls__message', phaseMessage(state)));
  const track = create('div', 'phase-track-ui'); track.setAttribute('aria-label', `Phase: ${phaseName}`);
  const steps = [['main', 'Main'], ['battle', 'Battle'], ['end', 'End']];
  const currentIndex = steps.findIndex(([phase]) => phase === state.phase);
  for (let index = 0; index < steps.length; index += 1) {
    const [phase, label] = steps[index]; const step = create('span', `phase-track-ui__step${index === currentIndex ? ' is-current' : currentIndex > index ? ' is-complete' : ''}`, label);
    if (index === currentIndex) step.setAttribute('aria-current', 'step'); track.append(step);
  }
  section.append(track);
  const priorityActions = legalActions.filter((action) => ['PASS', 'PASS_PRIORITY'].includes(action.type));
  const buttons = create('div', 'phase-controls__actions');
  if (actorId && priorityActions.length) renderActions(priorityActions, actorId, buttons);
  else if (state.menu || state.resolutionChoice || state.pendingMenuResolution) buttons.append(create('p', 'action-empty', 'Resolve the current choice or response before continuing.'));
  else if (state.status !== 'finished') buttons.append(create('p', 'action-empty', 'The other player has priority.'));
  section.append(buttons);
  return section;
}
function resourceAnimation(field) {
  for (const item of field.querySelectorAll('.battlefield-resource[data-player-id][data-resource]')) {
    const key = `${item.dataset.playerId}:${item.dataset.resource}`;
    const value = Number(item.querySelector('.battlefield-resource__value')?.textContent.replaceAll(',', ''));
    const previous = previousResourceValues.get(key);
    if (Number.isFinite(value) && previous !== undefined && value !== previous) {
      item.classList.remove('is-gained', 'is-spent');
      item.classList.add(value > previous ? 'is-gained' : 'is-spent');
    }
    if (Number.isFinite(value)) previousResourceValues.set(key, value);
  }
}
function renderMatch() {
  if (!match) return;
  const root = $('match-board'); root.replaceChildren();
  const actorId = match.status === 'finished' ? null : match.phase === 'first-player-choice' ? match.firstPlayerChooserId : match.phase === 'starting-main-selection' ? match.startingMainOrder[match.startingMainIndex] : match.phase === 'mulligan' ? match.mulliganOrder[match.mulliganIndex] : match.resolutionChoice?.playerId || match.menu?.priorityPlayerId || match.priorityPlayerId;
  const legalActions = actorId ? getLegalActions(match, actorId, cards) : [];
  const statusText = match.status === 'finished' ? (match.winnerId ? `${match.players[match.winnerId].name} wins` : 'Draw')
    : match.phase === 'first-player-choice' ? 'FIRST PLAYER CHOICE'
      : match.phase === 'starting-main-selection' ? 'STARTING MAIN SELECTION'
        : match.phase === 'mulligan' ? 'OPENING MULLIGAN'
          : `${match.players[match.activePlayerId].name} · TURN ${match.turnNumber} · ${match.phase.toUpperCase()}`;
  const statusDetail = phaseMessage(match);
  if (match.sandboxMode) root.append(create('p', 'sandbox-match-badge', 'LOCAL SANDBOX · RESOURCE ADJUSTMENTS ENABLED'));
  const battlefield = renderBattlefield({
    state: match, localPlayerId: 'p1', cards, actorId, legalActions, selectedInstanceId,
    statusText, statusDetail, onInspect: showCard,
    onSelectCard: (instanceId) => { selectedInstanceId = selectedInstanceId === instanceId ? null : instanceId; renderMatch(); },
    sandboxMode: match.sandboxMode && match.status === 'active' && ['main', 'battle', 'end'].includes(match.phase) && !match.menu && !match.pendingMenuResolution && !match.resolutionChoice && !match.combat && !match.pendingTriggers.length,
    onResourceAdjust: (playerId, resource, delta) => safeDispatch({ type: 'PRACTICE_ADJUST_RESOURCE', playerId, resource, delta })
  });
  root.append(battlefield); resourceAnimation(battlefield);
  root.append(renderPhaseControls(match, actorId, legalActions));
  if (match.resolutionChoice) {
    const prompt = create('section', 'turn-controls');
    prompt.append(create('strong', '', match.resolutionChoice.prompt)); root.append(prompt);
  }
  if (match.resolutionChoice?.kind === 'DECK_REVEAL') {
    const reveal = create('section', 'turn-controls');
    reveal.append(create('strong', '', 'Public reveal · '), create('span', '', match.resolutionChoice.revealedInstanceIds.map(cardName).join(' · ') || 'No cards were available to reveal.')); root.append(reveal);
  }
  if (match.status !== 'finished') {
    const controls = create('section', 'turn-controls'); controls.append(create('h3', '', `${match.players[actorId].name} · ${selectedInstanceId ? 'selected card actions' : 'legal actions'}`));
    if (selectedInstanceId) {
      const instance = match.instances[selectedInstanceId], selectedCard = cards.find((card) => card.id === instance?.cardId);
      const context = create('div', 'selected-action-context');
      context.append(create('span', '', selectedCard?.name || 'Selected card'));
      if (selectedCard) context.append(actionButton('Inspect card', () => showCard(selectedCard), 'action-inspect'));
      context.append(actionButton('Cancel selection', () => { selectedInstanceId = null; renderMatch(); }, 'action-cancel'));
      controls.append(context);
    }
    const phaseActions = new Set(['PASS', 'PASS_PRIORITY']);
    const actions = create('div', 'action-list');
    renderActions(legalActions.filter((action) => !phaseActions.has(action.type)), actorId, actions, selectedInstanceId);
    controls.append(actions); root.append(controls);
  }
  const log = create('section', 'game-log'), title = create('h3', '', 'Match log'), list = create('ol');
  match.log.slice(-30).reverse().forEach((entry) => list.append(create('li', '', logLabel(entry)))); log.append(title, list); root.append(log);
}
function showView(view, mode = 'deck') {
  document.querySelectorAll('.view').forEach((el) => { el.classList.toggle('is-visible', el.id === `${view}-view`); el.hidden = el.id !== `${view}-view`; });
  if (view === 'library') {
    const cardsMode = mode === 'cards';
    $('library-view').classList.toggle('is-deck-mode', !cardsMode);
    $('library-view').classList.toggle('is-cards-mode', cardsMode);
    $('deck-heading').hidden = cardsMode;
    $('cards-heading').hidden = !cardsMode;
    panel?.setMode(cardsMode ? 'cards' : 'deck');
  }
  document.querySelectorAll('.nav-button').forEach((el) => el.classList.toggle('is-active', el.dataset.view === view && (view !== 'library' || (el.dataset.mode || 'deck') === mode)));
}

for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => showView(button.dataset.view, button.dataset.mode || 'deck'));
$('deck-select').addEventListener('change', (event) => { activeDeckId = event.target.value; syncDeckUI(); });
$('deck-name').addEventListener('input', () => { const deck = currentDeck(); if (deck) deck.name = $('deck-name').value; });
$('save-deck').addEventListener('click', saveDeck);
$('new-deck').addEventListener('click', () => newDeck());
$('duplicate-deck').addEventListener('click', () => currentDeck() && newDeck(currentDeck()));
$('delete-deck').addEventListener('click', () => { if (!currentDeck() || !confirm(`Delete ${currentDeck().name}?`)) return; saved = saved.filter((deck) => deck.id !== activeDeckId); activeDeckId = saved[0]?.id || null; persist(); syncDeckUI(); });
$('export-deck').addEventListener('click', exportDeck);
$('import-deck').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (event) => { try { await importDeck(event.target.files?.[0]); } catch (error) { alert(error.message); } event.target.value = ''; });
$('start-match').addEventListener('click', startMatch);
$('reset-match').addEventListener('click', () => { match = null; selectedInstanceId = null; previousResourceValues.clear(); $('match-board').hidden = true; $('reset-match').disabled = true; $('practice-tools').disabled = false; $('match-notice').textContent = 'Local match cleared.'; });

try {
  await loadCards(); cards = allCards(); $('card-count').textContent = cards.length.toLocaleString(); $('library-count').textContent = cards.length.toLocaleString();
  const response = await fetch('data/source/decks.json'); if (!response.ok) throw new Error('Could not load the registered sample decks.'); samples = await response.json();
  initSavedDecks(); mountBrowser(); syncDeckUI();
  $('implemented-effects').textContent = `${implementedEffectIds().length}/${cards.length} effects · ${supportedTransformationIds().length} form entries`;
  $('match-notice').textContent = 'Choose two validated decks. A random chooser will select who goes first after the match begins.';
} catch (error) {
  $('match-notice').textContent = `Application data could not load: ${error.message}`;
  $('implemented-effects').textContent = 'Data loading failed';
}

