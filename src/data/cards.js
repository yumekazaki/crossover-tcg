/** Canonical card access. Call loadCards() before the synchronous query APIs. */
const DATA_URL = new URL('../../data/cards.json', import.meta.url);
const PUBLIC_URL = new URL('../../public/', import.meta.url);
let records = [];
let index = new Map();
let loading;
let loaded = false;
const verifiedArtwork = new Map();

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function ready() {
  if (!loaded) throw new Error('Card data is not loaded. Await loadCards() first.');
}

function approved(art) {
  return art?.redistribution_approved === true ||
    art?.redistribution_permission === true ||
    art?.redistribution_permission === 'approved';
}

/** Only explicit relative paths inside public/ are eligible to be served. */
function localArtworkURL(art) {
  const path = art?.local_asset_path || art?.asset_path;
  if (typeof path !== 'string' || !path || /[\\?#]/.test(path)) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) return null;
  let relative = path.replace(/^\//, '').replace(/^public\//, '');
  try { relative = decodeURIComponent(relative); } catch { return null; }
  if (relative.split('/').some(part => part === '..' || part === '.')) return null;
  if (!/\.(?:png|jpe?g|webp|gif|avif)$/i.test(relative)) return null;
  const url = new URL(relative, PUBLIC_URL);
  return url.href.startsWith(PUBLIC_URL.href) ? url : null;
}

async function existingLocalImage(url) {
  if (url.protocol === 'file:' && typeof process !== 'undefined' && process.versions?.node) {
    const { stat } = await import('node:fs/promises');
    try { return (await stat(url)).isFile(); } catch { return false; }
  }
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'error' });
    return response.ok && /^image\//i.test(response.headers.get('content-type') || '');
  } catch { return false; }
}

/** Loads the original 500 definitions without renaming, normalizing, or adding fields. */
export async function loadCards() {
  if (loaded) return allCards();
  if (!loading) loading = (async () => {
    let data;
    if (DATA_URL.protocol === 'file:' && typeof process !== 'undefined' && process.versions?.node) {
      const { readFile } = await import('node:fs/promises');
      data = JSON.parse(await readFile(DATA_URL, 'utf8'));
    } else {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`Unable to load card data (${response.status}).`);
      data = await response.json();
    }
    if (!Array.isArray(data) || data.length !== 500) throw new Error('Expected exactly 500 canonical card records.');
    const nextIndex = new Map();
    for (const card of data) {
      if (!card || typeof card.id !== 'string' || !card.id || nextIndex.has(card.id)) {
        throw new Error('Canonical card records must have unique nonempty identifiers.');
      }
      nextIndex.set(card.id, card);
    }
    // A source citation, attached status, or downloaded original is never permission.
    await Promise.all(data.filter(c => approved(c.artwork)).map(async card => {
      const url = localArtworkURL(card.artwork);
      if (url && await existingLocalImage(url)) verifiedArtwork.set(card.id, { artwork: card.artwork, url: url.href });
    }));
    records = data.map(freeze);
    index = nextIndex;
    loaded = true;
    return allCards();
  })().catch(error => {
    loading = undefined;
    verifiedArtwork.clear();
    throw error;
  });
  return loading;
}

export function allCards() { ready(); return records.slice(); }
export function getCard(id) { ready(); return index.get(id) || null; }

const fold = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US');
const list = value => value == null || value === '' ? [] : Array.isArray(value) ? value : [value];
function matches(value, filter) {
  const choices = list(filter).map(fold);
  return !choices.length || choices.includes(fold(value));
}
function range(value, specification) {
  if (specification == null || specification === '') return true;
  if (typeof specification === 'number') return value === specification;
  if (typeof specification !== 'object') return value === Number(specification);
  return (specification.min == null || value >= Number(specification.min)) &&
    (specification.max == null || value <= Number(specification.max));
}

/**
 * Scalar franchise/type/rarity filters also accept arrays (OR).
 * subtype/subtypes and keyword/keywords accept arrays (AND).
 * Numeric cost means maximum total cost; object cost supports min/max total and
 * exact or {min,max} light/darkness/momentum components. No record is changed.
 */
export function searchCards(query = '', filters = {}) {
  ready();
  filters ||= {};
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  const subtypes = [...list(filters.subtype), ...list(filters.subtypes)].map(fold);
  const keywords = [...list(filters.keyword), ...list(filters.keywords)].map(fold);
  return records.filter(card => {
    if (!matches(card.franchise, filters.franchise) || !matches(card.type, filters.type) || !matches(card.rarity, filters.rarity)) return false;
    const tags = (card.subtypes || []).map(fold);
    if (!subtypes.every(tag => tags.includes(tag))) return false;
    const effect = fold(card.effect_text);
    if (!keywords.every(word => effect.includes(word))) return false;
    const haystack = fold([card.id, card.name, card.franchise, card.game, card.type, card.effect_text,
      ...(card.subtypes || []), ...(card.affiliations || []), ...(card.archetypes || [])].join(' '));
    if (!terms.every(term => haystack.includes(term))) return false;
    const cost = card.cost || {};
    const total = (cost.light || 0) + (cost.darkness || 0) + (cost.momentum || 0);
    if (filters.minCost != null && total < Number(filters.minCost)) return false;
    if (filters.maxCost != null && total > Number(filters.maxCost)) return false;
    if (typeof filters.cost === 'number') return total <= filters.cost;
    if (filters.cost && typeof filters.cost === 'object') {
      if (!range(total, { min: filters.cost.min, max: filters.cost.max })) return false;
      for (const resource of ['light', 'darkness', 'momentum']) {
        if (!range(cost[resource] || 0, filters.cost[resource])) return false;
      }
    }
    return true;
  });
}

/** D001: three copies per exact ID across registration, not per display name. */
export function validateDeck({ mainIds, equipmentIds } = {}) {
  ready();
  const errors = [];
  if (!Array.isArray(mainIds)) errors.push('Main Deck must be an array of card IDs.');
  if (!Array.isArray(equipmentIds)) errors.push('Equipment/Transformation Deck must be an array of card IDs.');
  const main = Array.isArray(mainIds) ? mainIds : [];
  const equipment = Array.isArray(equipmentIds) ? equipmentIds : [];
  if (main.length < 40 || main.length > 60) errors.push('Main Deck must contain 40–60 cards.');
  if (!main.some((id) => { const card = index.get(id); return card?.type === 'Character' && !card.transformation; })) errors.push('Main Deck must contain at least one nontransformed Character for starting Main selection.');
  let equipmentSlots = 0, finisherCount = 0;
  const copies = new Map();
  for (const [deck, ids] of [['Main', main], ['Equipment/Transformation', equipment]]) {
    ids.forEach((id, position) => {
      const card = index.get(id);
      if (!card) { errors.push(`Unknown card ID at ${deck} position ${position + 1}: ${String(id)}.`); return; }
      copies.set(id, (copies.get(id) || 0) + 1);
      if (card.deck !== deck) errors.push(`${card.name} (${id}) belongs in the ${card.deck} Deck.`);
      if (deck === 'Main' && card.type === 'Finisher') finisherCount++;
      if (deck === 'Equipment/Transformation') equipmentSlots += card.slots;
    });
  }
  if (equipmentSlots !== 20) errors.push(`Equipment/Transformation Deck must use exactly 20 slots; found ${equipmentSlots}.`);
  for (const [id, count] of copies) if (count > 3) errors.push(`${index.get(id).name} (${id}) exceeds three copies across both decks (${count}).`);
  if (finisherCount > 6) errors.push(`Main Deck may contain at most six Finishers; found ${finisherCount}.`);
  return { valid: errors.length === 0, errors, mainCount: main.length, equipmentSlots, finisherCount };
}

/** Synchronous after loadCards(): no remote source image is ever a display URL. */
export function getArtwork(card) {
  const art = card?.artwork;
  const verified = card && verifiedArtwork.get(card.id);
  const usable = approved(art) && verified?.artwork === art;
  return {
    src: usable ? verified.url : null,
    placeholder: !usable,
    label: usable ? `${card.name} artwork` : `Artwork unavailable — ${card?.name || 'Unknown card'}`,
    sourceUrl: art?.source_page || art?.source_url || card?.canonical_source?.url || null,
    credit: art?.credit || null,
  };
}
