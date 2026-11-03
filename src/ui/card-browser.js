/** Card-library panel. Data and legality stay with the calling application. */
import { getArtwork } from '../data/cards.js?v=20261103-artworkfix4';

export function createCardBrowser({ cards = [], deck = {}, onAdd, onRemove } = {}) {
  let records = Array.isArray(cards) ? cards.slice() : [];
  let currentDeck = deck || {};
  let validation = null;
  let selectedId = records[0]?.id || null;
  let visibleLimit = 36;
  let notice = '';
  let sortBy = 'set';
  let activeDeckSection = 'mainIds';
  let requestNumber = 0;
  let appliedRequest = 0;
  const pending = new Set();
  const filters = { text: '', franchise: '', type: '', subtype: '', rarity: '', light: '', darkness: '', momentum: '' };
  const types = ['Character', 'Equipment', 'Ability', 'Speed Ability', 'Finisher'];
  const root = el('section', 'ctcg-browser');
  root.setAttribute('aria-label', 'Card library and deck builder');
  const lookup = () => new Map(records.map(card => [card.id, card]));
  const uniqueId = `ctcg-${Math.random().toString(36).slice(2, 9)}`;

  const heading = el('header', 'ctcg-browser__heading');
  heading.append(el('p', 'ctcg-browser__eyebrow', 'CROSSOVER TCG · CARD TOOLKIT'));
  heading.append(el('h2', '', 'Search cards and shape a deck.'));
  heading.append(el('p', 'ctcg-browser__intro', 'Choose cards from across the set, then check your list in the Deck Workshop.'));
  root.append(heading);

  const toolbar = el('div', 'ctcg-browser__toolbar');
  const searchLabel = el('label', 'ctcg-browser__search');
  searchLabel.append(el('span', 'ctcg-browser__field-label', 'Search the library'));
  const search = el('input');
  search.type = 'search'; search.placeholder = 'Name, card ID, effect, or keyword';
  search.autocomplete = 'off'; search.spellcheck = false;
  search.addEventListener('input', () => { filters.text = search.value; visibleLimit = 36; renderResults(); });
  searchLabel.append(search); toolbar.append(searchLabel);
  const reset = button('Reset filters', 'ctcg-browser__quiet', () => {
    Object.keys(filters).forEach(key => { filters[key] = ''; });
    search.value = ''; controls.forEach(control => { control.value = ''; });
    sortBy = 'set'; sort.value = 'set';
    visibleLimit = 36; renderResults(); search.focus();
  });
  toolbar.append(reset); root.append(toolbar);

  const sortLabel = el('label', 'ctcg-browser__sort');
  sortLabel.append(el('span', 'ctcg-browser__field-label', 'Sort cards'));
  const sort = el('select'); sort.setAttribute('aria-label', 'Sort cards');
  for (const [value, label] of [['set', 'Set order'], ['name', 'Name A–Z'], ['cost', 'Lowest resource cost'], ['attack', 'Highest attack'], ['health', 'Highest HP']]) {
    const option = el('option', '', label); option.value = value; sort.append(option);
  }
  sort.addEventListener('change', () => { sortBy = sort.value; renderResults(); });
  sortLabel.append(sort); toolbar.insertBefore(sortLabel, reset);

  const controls = new Map();
  const filterRow = el('div', 'ctcg-browser__filters');
  for (const [key, label] of [['franchise', 'Franchise'], ['type', 'Card type'], ['subtype', 'Subtype'], ['rarity', 'Rarity']]) {
    const wrap = el('label'); wrap.append(el('span', 'ctcg-browser__field-label', label));
    const select = el('select'); select.id = `${uniqueId}-${key}`;
    select.setAttribute('aria-label', label);
    select.addEventListener('change', () => { filters[key] = select.value; visibleLimit = 36; renderResults(); });
    controls.set(key, select); wrap.append(select); filterRow.append(wrap);
  }
  const costGroup = el('fieldset', 'ctcg-browser__cost-filters');
  costGroup.append(el('legend', 'ctcg-browser__field-label', 'Maximum resource cost'));
  for (const [key, label] of [['light', 'Light'], ['darkness', 'Dark'], ['momentum', 'Momentum']]) {
    const wrap = el('label'); wrap.append(el('span', '', label));
    const input = el('input'); input.type = 'number'; input.min = '0'; input.step = '1'; input.placeholder = 'Any';
    input.inputMode = 'numeric';
    input.addEventListener('input', () => { filters[key] = input.value; visibleLimit = 36; renderResults(); });
    controls.set(key, input); wrap.append(input); costGroup.append(wrap);
  }
  filterRow.append(costGroup); root.append(filterRow);

  const workspace = el('div', 'ctcg-browser__workspace');
  const library = el('section', 'ctcg-browser__library');
  library.setAttribute('aria-label', 'Filtered card results');
  const resultsHeading = el('div', 'ctcg-browser__section-heading');
  resultsHeading.append(el('h3', '', 'Card library'));
  const resultCount = el('p', 'ctcg-browser__result-count');
  resultCount.setAttribute('role', 'status'); resultCount.setAttribute('aria-live', 'polite');
  resultsHeading.append(resultCount); library.append(resultsHeading);
  const results = el('div', 'ctcg-browser__cards');
  const more = button('Show more cards', 'ctcg-browser__more', () => { visibleLimit += 36; renderResults(); });
  library.append(results, more);
  const detail = el('section', 'ctcg-browser__detail'); detail.setAttribute('aria-label', 'Selected card details');
  const deckPanel = el('section', 'ctcg-browser__deck'); deckPanel.setAttribute('aria-label', 'Current deck');
  workspace.append(library, detail, deckPanel); root.append(workspace);
  const live = el('p', 'ctcg-browser__notice'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
  root.append(live);

  function populateFilters() {
    const values = {
      franchise: [...new Set(records.map(c => c.franchise).filter(Boolean))].sort(),
      type: types.filter(t => records.some(c => c.type === t)),
      subtype: [...new Set(records.flatMap(c => Array.isArray(c.subtypes) ? c.subtypes : []))].sort(),
      rarity: ['Common', 'Uncommon', 'Rare', 'Mythic'].filter(t => records.some(c => c.rarity === t)),
    };
    for (const [key, options] of Object.entries(values)) {
      const control = controls.get(key); control.replaceChildren();
      const any = el('option', '', `All ${key === 'type' ? 'card types' : key === 'rarity' ? 'rarities' : key === 'subtype' ? 'subtypes' : 'franchises'}`);
      any.value = ''; control.append(any);
      options.forEach(value => { const option = el('option', '', value); option.value = value; control.append(option); });
      if (!options.includes(filters[key])) filters[key] = '';
      control.value = filters[key];
    }
  }

  function deckIds() {
    return {
      mainIds: Array.isArray(currentDeck.mainIds) ? currentDeck.mainIds.slice() : [],
      equipmentIds: Array.isArray(currentDeck.equipmentIds) ? currentDeck.equipmentIds.slice() : [],
    };
  }
  function copyCount(card) {
    const ids = deckIds();
    return [...ids.mainIds, ...ids.equipmentIds].filter(id => id === card.id).length;
  }
  function sectionFor(card) { return card.deck === 'Equipment/Transformation' || card.type === 'Equipment' || card.transformation ? 'equipment' : 'main'; }

  async function act(cardId, operation, explicitSection) {
    const callback = operation === 'add' ? onAdd : onRemove;
    if (typeof callback !== 'function' || pending.has(cardId)) return;
    const card = lookup().get(cardId); const section = explicitSection || (card ? sectionFor(card) : 'main');
    const focusKey = document.activeElement?.dataset?.focusKey;
    const thisRequest = ++requestNumber; pending.add(cardId); notice = '';
    refresh();
    try {
      const response = await callback(cardId, section);
      if (thisRequest >= appliedRequest) {
        appliedRequest = thisRequest;
        if (response?.deck) currentDeck = response.deck;
        if (response && Array.isArray(response.mainIds) && Array.isArray(response.equipmentIds)) currentDeck = response;
        if (response?.validation !== undefined) validation = response.validation;
        else if (looksLikeValidation(response)) validation = response;
      }
      if (thisRequest === requestNumber) {
        const now = copyCount(card || { id: cardId });
        const deckLabel = section === 'equipment' ? 'Equipment / Transformation Deck' : 'Main Deck';
        notice = `${operation === 'add' ? 'Added' : 'Removed'} ${card?.name || cardId}${operation === 'add' ? ` to ${deckLabel}` : ` from ${deckLabel}`}. ${now} ${now === 1 ? 'copy' : 'copies'} now in your deck.`;
      }
    } catch (error) {
      if (thisRequest === requestNumber) notice = error instanceof Error ? error.message : 'The deck update could not be completed.';
    } finally {
      pending.delete(cardId); refresh();
      if (focusKey && document.activeElement === document.body) {
        [...root.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === focusKey && !node.disabled)?.focus({ preventScroll: true });
      }
    }
  }

  function renderResults() {
    const query = filters.text.trim().toLocaleLowerCase();
    const matches = records.filter(card => {
      if (filters.franchise && card.franchise !== filters.franchise) return false;
      if (filters.type && card.type !== filters.type) return false;
      if (filters.rarity && card.rarity !== filters.rarity) return false;
      if (filters.subtype && !(card.subtypes || []).includes(filters.subtype)) return false;
      for (const resource of ['light', 'darkness', 'momentum']) {
        if (filters[resource] !== '' && Number.isFinite(Number(filters[resource])) && Number(card.cost?.[resource] || 0) > Number(filters[resource])) return false;
      }
      if (!query) return true;
      const haystack = [card.name, card.id, card.franchise, card.game, card.type, card.effect_text, card.strategic_purpose, ...(card.subtypes || []), ...(card.archetypes || []), ...(card.affiliations || [])].filter(Boolean).join(' ').toLocaleLowerCase();
      return query.split(/\s+/).every(word => haystack.includes(word));
    });
    if (sortBy !== 'set') {
      const setOrder = new Map(records.map((card, index) => [card.id, index]));
      const valueFor = (card) => sortBy === 'name' ? card.name.toLocaleLowerCase()
        : sortBy === 'cost' ? ['light', 'darkness', 'momentum'].reduce((sum, key) => sum + Number(card.cost?.[key] || 0), 0)
          : Number(card.statistics?.[sortBy === 'attack' ? 'atk' : 'hp'] || 0);
      matches.sort((a, b) => {
        const av = valueFor(a), bv = valueFor(b);
        const compared = typeof av === 'string' ? av.localeCompare(bv) : sortBy === 'cost' ? av - bv : bv - av;
        return compared || setOrder.get(a.id) - setOrder.get(b.id);
      });
    }
    resultCount.textContent = `${matches.length} of ${records.length} cards`;
    results.replaceChildren();
    if (!matches.length) {
      const empty = el('div', 'ctcg-browser__empty'); empty.append(el('h4', '', 'No matching cards'), el('p', '', 'Try a broader keyword or reset your filters.')); results.append(empty);
    }
    for (const card of matches.slice(0, visibleLimit)) {
      const tile = el('article', `ctcg-browser__card ctcg-browser__card--${typeClass(card.type)}`);
      if (card.id === selectedId) tile.classList.add('is-selected');
      const inspect = button('', 'ctcg-browser__inspect', () => {
        selectedId = card.id; renderResults(); renderDetail();
        [...results.querySelectorAll('[data-inspect-id]')].find(node => node.dataset.inspectId === card.id)?.focus({ preventScroll: true });
      });
      inspect.dataset.inspectId = card.id;
      inspect.setAttribute('aria-label', `Inspect ${card.name}, ${card.type}, ${card.id}`);
      inspect.setAttribute('aria-pressed', String(card.id === selectedId));
      inspect.append(renderArtwork(card, 'ctcg-browser__tile-art'));
      const meta = el('div', 'ctcg-browser__card-meta');
      meta.append(el('span', 'ctcg-browser__type', card.type), el('span', 'ctcg-browser__rarity', card.rarity || 'Unrated'));
      inspect.append(meta, el('h4', '', card.name), el('p', 'ctcg-browser__franchise', card.franchise || 'Unspecified franchise'));
      const stats = card.statistics ? `ATK ${format(card.statistics.atk)} · HP ${format(card.statistics.hp)}` : costText(card.cost);
      inspect.append(el('p', 'ctcg-browser__card-stats', stats));
      inspect.append(el('p', 'ctcg-browser__excerpt', card.effect_text || 'No effect text recorded.'));
      const foot = el('div', 'ctcg-browser__card-footer');
      foot.append(el('span', '', card.id), el('span', '', `${copyCount(card)} in deck`)); inspect.append(foot);
      const add = button('+ Add', 'ctcg-browser__tile-add', () => act(card.id, 'add'));
      add.dataset.focusKey = `tile-add:${card.id}`;
      add.setAttribute('aria-label', `Add ${card.name} to ${sectionFor(card) === 'equipment' ? 'Equipment/Transformation' : 'Main'} Deck`);
      add.disabled = typeof onAdd !== 'function' || pending.has(card.id) || copyCount(card) >= 3;
      if (copyCount(card) >= 3) add.title = 'Three-copy limit reached across both decks.';
      tile.append(inspect, add); results.append(tile);
    }
    more.hidden = matches.length <= visibleLimit;
    more.textContent = `Show ${Math.min(36, Math.max(0, matches.length - visibleLimit))} more cards`;
  }

  function renderDetail() {
    detail.replaceChildren();
    const card = lookup().get(selectedId);
    if (!card) { detail.append(el('h3', '', 'A closer look'), el('p', 'ctcg-browser__muted', 'Select a card to read its full effect and requirements.')); return; }
    const art = renderArtwork(card, 'ctcg-browser__art');
    detail.append(el('p', 'ctcg-browser__eyebrow', `${card.id} · ${card.rarity || 'Unrated'}`), art, el('h3', 'ctcg-browser__detail-name', card.name));
    detail.append(el('p', 'ctcg-browser__muted', `${card.franchise || 'Unspecified franchise'}${card.game ? ` · ${card.game}` : ''}`));
    const tags = el('div', 'ctcg-browser__tags');
    [card.type, ...(card.subtypes || [])].filter(Boolean).forEach(tag => tags.append(el('span', '', tag))); detail.append(tags);
    const facts = el('dl', 'ctcg-browser__facts');
    fact(facts, 'Resource cost', costText(card.cost));
    if (card.statistics) { fact(facts, 'Attack', format(card.statistics.atk)); fact(facts, 'Maximum HP', format(card.statistics.hp)); }
    fact(facts, 'Deck', sectionFor(card) === 'equipment' ? 'Equipment/Transformation' : 'Main');
    fact(facts, 'Slots per copy', String(card.slots ?? (card.transformation ? 2 : 1)));
    fact(facts, 'Copies of this card ID', `${copyCount(card)} / 3`);
    detail.append(facts, el('h4', 'ctcg-browser__small-heading', 'Full effect'), el('p', 'ctcg-browser__effect', card.effect_text || 'No effect text recorded.'));
    for (const [label, value] of [['Timing', card.timing], ['Targets', card.targets], ['Requirements', requirementText(card.requirements)], ['Purpose', card.strategic_purpose], ['Affiliations', (card.affiliations || []).join(', ')]]) {
      if (value) detail.append(el('h4', 'ctcg-browser__small-heading', label), el('p', 'ctcg-browser__detail-copy', value));
    }
    if (card.transformation?.entry_requirement) detail.append(el('h4', 'ctcg-browser__small-heading', 'Transformation entry'), el('p', 'ctcg-browser__detail-copy', card.transformation.entry_requirement));
    const actions = el('div', 'ctcg-browser__detail-actions');
    const add = button('+ Add to deck', 'ctcg-browser__primary', () => act(card.id, 'add')); add.disabled = typeof onAdd !== 'function' || pending.has(card.id) || copyCount(card) >= 3;
    if (copyCount(card) >= 3) add.title = 'Three-copy limit reached across both decks.';
    add.dataset.focusKey = `detail-add:${card.id}`;
    const remove = button('Remove one', 'ctcg-browser__quiet', () => act(card.id, 'remove')); remove.disabled = typeof onRemove !== 'function' || !copyCount(card) || pending.has(card.id);
    remove.dataset.focusKey = `detail-remove:${card.id}`;
    actions.append(add, remove); detail.append(actions);
    detail.append(el('p', 'ctcg-browser__rights-note', getArtwork(card).placeholder
      ? 'This card has no locally attached image cleared for display. Source credits alone do not grant image reuse rights.'
      : `Artwork credit: ${getArtwork(card).credit || 'credit not recorded'}`));
  }

  function renderArtwork(card, className) {
    const artwork = getArtwork(card);
    const frame = el('div', `${className} ctcg-browser__card--${typeClass(card.type)}`);
    if (artwork.src) {
      const image = el('img', 'ctcg-browser__art-image');
      image.src = artwork.src;
      image.alt = artwork.label;
      image.loading = 'lazy';
      image.decoding = 'async';
      frame.append(image);
      frame.setAttribute('role', 'img');
      frame.setAttribute('aria-label', artwork.label);
    } else {
      frame.setAttribute('role', 'img');
      frame.setAttribute('aria-label', `No approved artwork for ${card.name}.`);
      frame.append(el('span', 'ctcg-browser__art-mark', typeMark(card.type)),
        el('strong', '', card.name), el('span', '', 'Artwork pending approval'));
    }
    return frame;
  }

  function renderDeck() {
    deckPanel.replaceChildren(); const byId = lookup(); const ids = deckIds();
    const mainCount = ids.mainIds.length;
    const equipmentSlots = ids.equipmentIds.reduce((sum, id) => sum + Number(byId.get(id)?.slots ?? 1), 0);
    const deckHeading = el('div', 'ctcg-browser__section-heading'); deckHeading.append(el('h3', '', currentDeck.name || 'Your deck'), el('span', 'ctcg-browser__deck-symbol', '◇')); deckPanel.append(deckHeading);
    deckPanel.append(button('Browse cards to add', 'ctcg-browser__primary ctcg-browser__browse', () => root.dispatchEvent(new CustomEvent('browse-cards'))));
    const tabs = el('div', 'ctcg-browser__deck-tabs');
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Deck sections');
    const mainTab = button(`Main Deck · ${ids.mainIds.length}`, 'ctcg-browser__deck-tab', () => { activeDeckSection = 'mainIds'; renderDeck(); });
    const equipmentTab = button(`Equipment / Transformation · ${equipmentSlots}/20 slots`, 'ctcg-browser__deck-tab', () => { activeDeckSection = 'equipmentIds'; renderDeck(); });
    for (const [tab, key] of [[mainTab, 'mainIds'], [equipmentTab, 'equipmentIds']]) {
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(activeDeckSection === key));
      tab.tabIndex = activeDeckSection === key ? 0 : -1;
      tab.setAttribute('aria-controls', `${uniqueId}-${key}`); tab.id = `${uniqueId}-tab-${key}`;
      if (activeDeckSection === key) tab.classList.add('is-active');
      tabs.append(tab);
    }
    tabs.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const nextSection = activeDeckSection === 'mainIds' ? 'equipmentIds' : 'mainIds';
      activeDeckSection = nextSection; renderDeck();
      deckPanel.querySelector(`[role="tab"][aria-controls="${uniqueId}-${nextSection}"]`)?.focus();
    });
    deckPanel.append(tabs);
    const totals = el('div', 'ctcg-browser__totals');
    totals.append(metric(String(mainCount), 'Main cards', '40–60 required'), metric(String(equipmentSlots), 'E/T slots', '20 required'));
    deckPanel.append(totals);
    const combined = [...ids.mainIds, ...ids.equipmentIds];
    const idCounts = new Map(); combined.forEach(id => idCounts.set(id, (idCounts.get(id) || 0) + 1));
    deckPanel.append(el('p', 'ctcg-browser__deck-summary', `${combined.length} physical cards · ${idCounts.size} distinct card IDs · ${Math.max(0, ...idCounts.values())} highest copy count`));
    deckPanel.append(el('p', 'ctcg-browser__copy-rule', 'Up to 3 copies per exact card ID across both decks. Up to 6 Finishers in the Main Deck.'));
    const typeCounts = el('div', 'ctcg-browser__type-counts');
    types.forEach(type => { const count = combined.filter(id => byId.get(id)?.type === type).length; const item = el('span'); item.append(el('b', '', String(count)), document.createTextNode(` ${type}`)); typeCounts.append(item); });
    deckPanel.append(typeCounts);
    const legality = el('div', 'ctcg-browser__validation');
    renderValidation(legality); deckPanel.append(legality);
    for (const [key, label] of [['mainIds', 'Main Deck'], ['equipmentIds', 'Equipment / Transformation']]) {
      const section = el('section', 'ctcg-browser__deck-section'); section.id = `${uniqueId}-${key}`; section.setAttribute('role', 'tabpanel'); section.setAttribute('aria-labelledby', `${uniqueId}-tab-${key}`); section.hidden = activeDeckSection !== key; section.append(el('h4', '', label));
      if (!ids[key].length) section.append(el('p', 'ctcg-browser__muted', 'No cards added yet.'));
      const quantities = new Map(); ids[key].forEach(id => quantities.set(id, (quantities.get(id) || 0) + 1));
      const list = el('ul', 'ctcg-browser__deck-list');
      for (const [id, quantity] of quantities) {
        const card = byId.get(id); const row = el('li');
        const name = button(card?.name || `Unknown card: ${id}`, 'ctcg-browser__deck-card-name', () => { if (card) { selectedId = id; renderResults(); renderDetail(); } });
        name.disabled = !card; name.title = id;
        const count = el('span', 'ctcg-browser__quantity', `×${quantity}`);
        const add = button('+', 'ctcg-browser__deck-add', () => act(id, 'add', key === 'mainIds' ? 'main' : 'equipment'));
        add.dataset.focusKey = `deck-add:${key}:${id}`;
        add.setAttribute('aria-label', `Add another ${card?.name || id} to ${label}`);
        add.disabled = typeof onAdd !== 'function' || pending.has(id) || copyCount(card || { id }) >= 3;
        if (copyCount(card || { id }) >= 3) add.title = 'Three-copy limit reached across both decks.';
        const remove = button('−', 'ctcg-browser__deck-remove', () => act(id, 'remove', key === 'mainIds' ? 'main' : 'equipment'));
        remove.dataset.focusKey = `deck-remove:${key}:${id}`;
        remove.setAttribute('aria-label', `Remove one ${card?.name || id} from ${label}`); remove.disabled = typeof onRemove !== 'function' || pending.has(id);
        row.classList.add('ctcg-browser__deck-row'); row.append(name, count, add, remove); list.append(row);
      }
      section.append(list); deckPanel.append(section);
    }
  }

  function renderValidation(container) {
    container.replaceChildren();
    if (validation == null) { container.append(el('strong', '', 'Validation awaits a deck update'), el('p', '', 'Counts are informational. The application checks deck legality.')); return; }
    const valid = validation === true || validation.valid === true || validation.isValid === true || validation.ok === true;
    const errors = validation === false ? ['The deck did not pass validation.'] : normalizeMessages(validation.errors ?? validation.issues);
    const warnings = normalizeMessages(validation.warnings);
    container.classList.toggle('is-valid', valid && !errors.length); container.classList.toggle('has-errors', errors.length > 0 || validation === false);
    container.append(el('strong', '', valid && !errors.length ? 'Deck validation passed' : errors.length ? 'Deck needs attention' : 'Validation status'));
    if (typeof validation.message === 'string') container.append(el('p', '', validation.message));
    if (errors.length || warnings.length) { const list = el('ul'); errors.forEach(message => list.append(el('li', '', message))); warnings.forEach(message => list.append(el('li', '', `Note: ${message}`))); container.append(list); }
    if (!valid && !errors.length && !warnings.length) container.append(el('p', '', 'The validator has not reported a passing deck.'));
  }

  function refresh() { renderResults(); renderDetail(); renderDeck(); live.textContent = notice; }
  /** Root-owned state can be refreshed without remounting controls or losing filters. */
  root.update = function update(next = {}) {
    if (Array.isArray(next.cards)) { records = next.cards.slice(); populateFilters(); if (!records.some(c => c.id === selectedId)) selectedId = records[0]?.id || null; }
    if (next.deck !== undefined) { currentDeck = next.deck || {}; appliedRequest = requestNumber; }
    if (next.validation !== undefined) validation = next.validation;
    if (next.onAdd !== undefined) onAdd = next.onAdd;
    if (next.onRemove !== undefined) onRemove = next.onRemove;
    refresh(); return root;
  };
  root.setMode = function setMode(mode) {
    const deckMode = mode !== 'cards';
    root.classList.toggle('is-deck-view', deckMode);
    root.classList.toggle('is-library-view', !deckMode);
    return root;
  };
  root.setMode('deck');
  populateFilters(); refresh(); return root;
}

function el(tag, className = '', text) { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = String(text); return node; }
function button(text, className, action) { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', action); return node; }
function format(value) { return Number.isFinite(Number(value)) ? new Intl.NumberFormat().format(Number(value)) : '—'; }
function costText(cost = {}) { const parts = [['light', 'L'], ['darkness', 'D'], ['momentum', 'M']].filter(([key]) => Number(cost?.[key] || 0) > 0).map(([key, label]) => `${format(cost[key])}${label}`); return parts.length ? parts.join(' · ') : 'No printed resource cost'; }
function typeClass(type = '') { return type.toLowerCase().replace(/\s+/g, '-'); }
function typeMark(type) { return ({ Character: '◇', Equipment: '⚔', Ability: '✧', 'Speed Ability': '↯', Finisher: '✦' })[type] || '◇'; }
function fact(list, label, value) { list.append(el('dt', '', label), el('dd', '', value)); }
function metric(value, label, hint) { const node = el('div'); node.append(el('strong', '', value), el('span', '', label), el('small', '', hint)); return node; }
function requirementText(value) { if (!value) return ''; const all = (value.all || []).map(item => typeof item === 'string' ? item : JSON.stringify(item)); const any = (value.any || []).map(item => typeof item === 'string' ? item : JSON.stringify(item)); return [all.length ? all.join(' AND ') : '', any.length ? `(${any.join(' OR ')})` : ''].filter(Boolean).join(' AND '); }
function normalizeMessages(value) { if (!value) return []; return (Array.isArray(value) ? value : [value]).map(item => typeof item === 'string' ? item : item?.message || item?.reason || JSON.stringify(item)); }
function looksLikeValidation(value) { return typeof value === 'boolean' || !!value && typeof value === 'object' && ['valid', 'isValid', 'ok', 'errors', 'issues', 'warnings'].some(key => key in value); }

