import { loadCards, allCards, validateDeck, getArtwork } from './data/cards.js';
import { createCardBrowser } from './ui/card-browser.js';
import { createInitialState, dispatch, getLegalActions, assertStateInvariants } from './engine/game.js';
import { implementedEffectIds } from './engine/effects.js';
import { supportedTransformationIds } from './engine/transformations.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let cards = [];
let samples = [];
let saved = [];
let activeDeckId = null;
let panel;
let match = null;

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
    chooserId, seed: Math.floor(Math.random() * 0xffffffff), cards
  });
  match = state; $('match-board').hidden = false; $('reset-match').disabled = false;
  $('match-notice').textContent = `A random choice selected ${chooserId === 'p1' ? 'Player One' : 'Player Two'} to choose who goes first. Make that choice below. Local shared-device test only.`;
  renderMatch();
}
function cardName(instanceId) { const instance = match.instances[instanceId]; return cards.find((card) => card.id === instance?.cardId)?.name || instance?.cardId || 'Empty'; }
function safeDispatch(action) {
  try {
    match = dispatch(match, action, cards);
    assertStateInvariants(match, cards);
    if (match.phase === 'starting-main-selection') $('match-notice').textContent = `${match.players[match.startingMainOrder[match.startingMainIndex]].name} selects their Starting Main now.`;
    else if (match.phase === 'mulligan') $('match-notice').textContent = `Starting Mains are set. ${match.players[match.mulliganOrder[match.mulliganIndex]].name} may return up to five opening cards.`;
    else if (match.phase === 'main' && action.type === 'MULLIGAN') $('match-notice').textContent = 'Setup complete. The first player begins their Main Phase.';
    renderMatch();
  }
  catch (error) { const notice = $('match-notice'); notice.textContent = `${error.code || 'ERROR'}: ${error.message}`; notice.classList.add('is-error'); setTimeout(() => notice.classList.remove('is-error'), 4000); }
}
function create(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function renderCharacterZone(player, instanceId, label, isCenter = false) {
  const zone = create('button', `zone-card ${isCenter ? 'center' : instanceId ? '' : 'empty'}`); zone.type = 'button';
  if (!instanceId) { zone.disabled = true; zone.innerHTML = `<span class="zone-label">${esc(label)}</span><b>Open zone</b>`; return zone; }
  const instance = match.instances[instanceId], card = cards.find((x) => x.id === instance.cardId);
  const specialsSuppressed = (instance.characterSpecialsSuppressedUntilTurn ?? 0) > match.turnNumber;
  zone.innerHTML = `<span class="zone-label">${esc(label)}</span><b>${esc(card.name)}</b><small>${Number(instance.battlefield.currentHp).toLocaleString()} / ${Number(instance.battlefield.maxHp).toLocaleString()} HP · ${Number(card.statistics.atk).toLocaleString()} ATK${specialsSuppressed ? ' · Specials suppressed' : ''}</small>`;
  zone.addEventListener('click', () => showCard(card)); return zone;
}
function showCard(card) {
  const content = $('dialog-content'), art = getArtwork(card); content.className = 'dialog-content'; content.replaceChildren();
  content.append(create('p', 'eyebrow', `${card.id} · ${card.franchise} · ${card.game}`));
  content.append(create('h2', '', card.name));
  content.append(create('p', 'dialog-meta', `${card.type} · ${card.rarity} · ${card.subtypes.join(' / ') || 'No subtypes'}`));
  content.append(create('p', 'dialog-effect', card.effect_text));
  content.append(create('p', '', `Cost: ${card.cost.light} Light · ${card.cost.darkness} Darkness · ${card.cost.momentum} Momentum`));
  content.append(create('p', '', art.placeholder ? `${art.label}. The image source is recorded, but use rights are not approved for this application.` : art.credit));
  const supportedForm = supportedTransformationIds().includes(card.id);
  const effectStatus = implementedEffectIds().includes(card.id) ? 'implemented effect template'
    : supportedForm ? 'transformation entry and base requirements are supported; printed form effects are still pending'
      : card.type === 'Equipment' ? 'attachment procedure is supported; printed Equipment effects are not implemented'
        : 'effect not yet implemented; actions using it are disabled';
  content.append(create('p', '', `Engine status: ${effectStatus}.`));
  if (art.sourceUrl) { const link = create('a', '', 'Recorded source provenance'); link.href = art.sourceUrl; link.target = '_blank'; link.rel = 'noreferrer'; content.append(link); }
  $('card-dialog').showModal();
}
function renderSeat(playerId, revealHand = false) {
  const player = match.players[playerId], seat = create('article', 'seat'), header = create('div', 'seat-header');
  const isSelectingMain = match.phase === 'starting-main-selection' && match.startingMainOrder[match.startingMainIndex] === playerId;
  const name = create('h3', '', `${player.name}${!['first-player-choice', 'starting-main-selection'].includes(match.phase) && match.activePlayerId === playerId ? ' · TURN' : ''}${!['first-player-choice', 'starting-main-selection'].includes(match.phase) && match.priorityPlayerId === playerId ? ' · PRIORITY' : ''}${match.phase === 'first-player-choice' && match.firstPlayerChooserId === playerId ? ' · CHOOSER' : ''}${isSelectingMain ? ' · PICKING STARTING MAIN' : ''}`);
  const resources = create('div', 'seat-resources'); resources.innerHTML = `<b class="life">${player.life} LIFE</b><b>${player.resources.momentum} M</b><b>${player.resources.light} L</b><b>${player.resources.darkness} D</b>`; header.append(name, resources); seat.append(header);
  const zones = create('div', 'zones'); zones.append(renderCharacterZone(player, player.center, 'CENTER · MAIN', true));
  const party = create('div', 'party-zones'); player.party.forEach((id, index) => party.append(renderCharacterZone(player, id, `PARTY ${index + 1}`)));
  const board = create('div', 'zones'); board.style.display = 'block'; board.append(party); seat.append(zones, board);
  const attachments = Object.values(match.instances).filter((x) => x.zone === 'attached' && player.party.concat(player.center).includes(x.attachedTo));
  if (attachments.length) { const row = create('div', 'attached-row'); for (const gear of attachments) { const card = cards.find((x) => x.id === gear.cardId); const suppressed = (gear.abilitiesSuppressedUntilTurn ?? 0) > match.turnNumber; const b = create('span', 'gear-pill', `⚔ ${card.name} → ${cardName(gear.attachedTo)}${suppressed ? ' · abilities suppressed' : ''}`); row.append(b); } seat.append(row); }
  const hand = create('div', 'hand-area'), label = create('span', 'hand-label', `HAND · ${player.zones.hand.length} CARDS`), list = create('div', 'hand-cards');
  if (revealHand) for (const instanceId of player.zones.hand) { const card = cards.find((x) => x.id === match.instances[instanceId].cardId); const button = create('button', 'hand-card'); button.type = 'button'; button.textContent = card.name; const small = create('small', '', `${card.type} · ${card.cost.momentum}M`); button.append(small); button.addEventListener('click', () => showCard(card)); list.append(button); }
  else for (const _instanceId of player.zones.hand) { const back = create('button', 'hand-card concealed-card', 'Face down'); back.type = 'button'; back.disabled = true; list.append(back); }
  hand.append(label, list); seat.append(hand);
  const zonesInfo = create('p', 'seat-footnote', `Main Deck ${player.zones.mainDeck.length} · Continue? ${player.zones.continue.length} · Arsenal ${player.zones.arsenal.length} cards / ${player.registration.equipmentIds.reduce((n, id) => n + cards.find((x) => x.id === id).slots, 0)} slots`); seat.append(zonesInfo);
  return seat;
}
function actionButton(label, callback, klass = '') { const b = create('button', `action-button ${klass}`, label); b.type = 'button'; b.addEventListener('click', callback); return b; }
function renderActions(actions, actorId, container) {
  container.replaceChildren();
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
        ? action.decline ? ['union-cross', 'dorm-study-session'].includes(action.effectKind) ? 'Skip Character placement' : 'Skip adding an Ability' : action.stage === 'ADD_ABILITY' ? `Add ${cardName(action.instanceId)} to hand` : action.stage === 'ADD_PARTY' ? `Add ${cardName(action.instanceId)} to Party ${action.partyIndex + 1}` : action.stage === 'BOTTOM_HAND' ? `Put ${cardName(action.instanceId)} from hand on deck bottom` : `Put ${cardName(action.instanceId)} on deck bottom next`
        : `Discard ${cardName(action.instanceId)} to Continue?`;
      container.append(actionButton(label, () => safeDispatch({ ...action, playerId: actorId }), action.decline ? 'pass' : ''));
      continue;
    }
    if (action.type === 'CHOOSE_FIRST_PLAYER') { container.append(actionButton(`Choose ${match.players[action.firstPlayerId].name} to go first`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'SELECT_STARTING_MAIN') { container.append(actionButton(`Choose ${cardName(action.instanceId)} as Starting Main`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
    if (action.type === 'PASS') { container.append(actionButton('Pass priority', () => safeDispatch({ type: 'PASS', playerId: actorId }), 'pass')); continue; }
    if (action.type === 'PASS_PRIORITY') { container.append(actionButton(match.phasePasses ? 'Confirm pass · advance phase' : 'Pass empty phase window', () => safeDispatch({ type: 'PASS_PRIORITY', playerId: actorId }), 'pass')); continue; }
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
    if (action.type === 'ACTIVATE_SPECIAL') { const name = cardName(action.instanceId), cost = action.activationCostInstanceId ? ` · discard ${cardName(action.activationCostInstanceId)}` : ''; const targets = action.targets.map(cardName).join(' + '); const effect = name === 'Axel' ? `damage ${targets || 'no targets'}` : `return ${targets}`; container.append(actionButton(`Activate ${name} Special${cost} · ${effect}`, () => safeDispatch({ ...action, playerId: actorId }))); continue; }
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
  return `${p}${entry.type.replaceAll('_', ' ').toLocaleLowerCase()}${entry.cardId ? ` · ${cards.find((x) => x.id === entry.cardId)?.name || entry.cardId}` : ''}${entry.amount != null ? ` · ${entry.amount.toLocaleString()}` : ''}`;
}
function renderMatch() {
  if (!match) return;
  const root = $('match-board'); root.replaceChildren();
  const current = create('div', 'match-topline');
  current.append(create('strong', '', match.status === 'finished' ? (match.winnerId ? `${match.players[match.winnerId].name} wins` : 'Draw') : match.phase === 'first-player-choice' ? `First-player choice · ${match.players[match.firstPlayerChooserId].name} is chooser` : match.phase === 'starting-main-selection' ? `Starting Main · ${match.players[match.startingMainOrder[match.startingMainIndex]].name} chooses a Character` : match.status === 'setup' ? `Opening mulligan · ${match.players[match.mulliganOrder[match.mulliganIndex]].name}` : `${match.players[match.activePlayerId].name} · Turn ${match.turnNumber} · ${match.phase.toUpperCase()}`));
  current.append(create('span', '', match.phase === 'first-player-choice' ? `${match.players[match.firstPlayerChooserId].name} is choosing who goes first` : match.phase === 'starting-main-selection' ? `${match.players[match.startingMainOrder[match.startingMainIndex]].name} selects a nontransformed Character from their Main Deck` : match.resolutionChoice ? `Resolving effect · ${match.players[match.resolutionChoice.playerId].name} must choose` : match.menu ? `MENU ${match.menu.id} · ${match.players[match.menu.priorityPlayerId].name} has priority · ${match.menu.consecutivePasses}/2 passes` : `No open Menu · ${match.players[match.priorityPlayerId].name} has phase priority · ${match.phasePasses}/2 passes`)); root.append(current);
  const actorId = match.status === 'finished' ? null : match.phase === 'first-player-choice' ? match.firstPlayerChooserId : match.phase === 'starting-main-selection' ? match.startingMainOrder[match.startingMainIndex] : match.phase === 'mulligan' ? match.mulliganOrder[match.mulliganIndex] : match.resolutionChoice?.playerId || match.menu?.priorityPlayerId || match.priorityPlayerId;
  const seats = create('div', 'match-seats'); seats.append(renderSeat('p1', actorId === 'p1'), renderSeat('p2', actorId === 'p2')); root.append(seats);
  if (match.resolutionChoice) {
    const prompt = create('section', 'turn-controls');
    prompt.append(create('strong', '', match.resolutionChoice.prompt));
    root.append(prompt);
  }
  if (match.resolutionChoice?.kind === 'DECK_REVEAL') {
    const reveal = create('section', 'turn-controls');
    reveal.append(create('strong', '', 'Public reveal · '), create('span', '', match.resolutionChoice.revealedInstanceIds.map(cardName).join(' · ') || 'No cards were available to reveal.'));
    root.append(reveal);
  }
  if (match.status !== 'finished') {
    const controls = create('section', 'turn-controls'); controls.append(create('h3', '', `${match.players[actorId].name} · legal actions`));
    const actions = create('div', 'action-list'); renderActions(getLegalActions(match, actorId, cards), actorId, actions); controls.append(actions); root.append(controls);
  }
  const log = create('section', 'game-log'), title = create('h3', '', 'Match log'), list = create('ol');
  match.log.slice(-30).reverse().forEach((entry) => list.append(create('li', '', logLabel(entry)))); log.append(title, list); root.append(log);
}
function showView(view) {
  document.querySelectorAll('.view').forEach((el) => { el.classList.toggle('is-visible', el.id === `${view}-view`); el.hidden = el.id !== `${view}-view`; });
  document.querySelectorAll('.nav-button').forEach((el) => el.classList.toggle('is-active', el.dataset.view === view));
}

for (const button of document.querySelectorAll('.nav-button')) button.addEventListener('click', () => showView(button.dataset.view));
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
$('reset-match').addEventListener('click', () => { match = null; $('match-board').hidden = true; $('reset-match').disabled = true; $('match-notice').textContent = 'Local match cleared.'; });

try {
  await loadCards(); cards = allCards(); $('card-count').textContent = cards.length.toLocaleString();
  const response = await fetch('data/source/decks.json'); if (!response.ok) throw new Error('Could not load the registered sample decks.'); samples = await response.json();
  initSavedDecks(); mountBrowser(); syncDeckUI();
  $('implemented-effects').textContent = `${implementedEffectIds().length}/500 effects · ${supportedTransformationIds().length} form entries`;
  $('match-notice').textContent = 'Choose two validated decks. A random chooser will select who goes first after the match begins.';
} catch (error) {
  $('match-notice').textContent = `Application data could not load: ${error.message}`;
  $('implemented-effects').textContent = 'Data loading failed';
}
