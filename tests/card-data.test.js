import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCards, allCards, getCard, searchCards, validateDeck, getArtwork } from '../src/data/cards.js';

const original = JSON.parse(await readFile(new URL('../data/cards.json', import.meta.url), 'utf8'));
const harryPotterAnime = JSON.parse(await readFile(new URL('../data/sets/harry-potter-anime.json', import.meta.url), 'utf8'));
const importedDecks = JSON.parse(await readFile(new URL('../data/source/decks.json', import.meta.url), 'utf8'));
await loadCards();

function legalFixture() {
  const mainIds = allCards().filter(c => c.deck === 'Main' && c.type !== 'Finisher').slice(0, 40).map(c => c.id);
  const equipmentIds = allCards().filter(c => c.type === 'Equipment').slice(0, 20).map(c => c.id);
  return { mainIds, equipmentIds };
}

test('imports the original 500 unchanged and the distinct 50-card expansion', () => {
  assert.equal(original.length, 500);
  assert.equal(harryPotterAnime.length, 50);
  assert.equal(allCards().length, 550);
  assert.deepEqual(allCards().slice(0, original.length), original);
  assert.deepEqual(allCards().slice(original.length), harryPotterAnime);
  assert.equal(new Set(allCards().map(c => c.id)).size, 550);
  assert(harryPotterAnime.every(card => card.set_code === 'HPA' && card.franchise === 'Harry Potter (Anime)'));
  assert(harryPotterAnime.some(card => card.name.startsWith('Hermione')));
  assert(harryPotterAnime.some(card => card.name.startsWith('Ron')));
  assert(harryPotterAnime.some(card => card.name.includes('Voldemort')));
  assert(harryPotterAnime.filter(card => /Harry Potter|Draconia Malfoy|Harry & Draconia/.test(card.name)).length >= 8);
  assert(harryPotterAnime.every(card => !/Draco Malfoy/i.test(card.name)));
});
test('mechanical validation status matches focused engine coverage without implying balance or playtesting', () => {
  const coveredIds = ['CS1-005', 'CS1-011', 'CS1-177', 'CS1-178', 'CS1-281', 'CS1-282', 'CS1-285', 'CS1-290', 'CS1-311', 'CS1-316', 'CS1-319', 'CS1-320', 'CS1-334', 'CS1-339', 'CS1-394', 'CS1-433', 'CS1-436'];
  assert.deepEqual(allCards().filter((card) => card.status.mechanically_validated).map((card) => card.id).sort(), [...coveredIds].sort());
  for (const id of coveredIds) {
    assert.equal(getCard(id).status.mechanically_validated, true, `${id} should be marked mechanically validated`);
    assert.equal(getCard(id).status.balance_reviewed, false, `${id} has not been balance-reviewed`);
    assert.equal(getCard(id).status.playtested, false, `${id} has not been playtested`);
  }
});
test('loading is repeatable and synchronous lookups retain canonical identity', async () => {
  const [a, b] = await Promise.all([loadCards(), loadCards()]);
  assert.equal(a.length, 550);
  assert.equal(a[0], b[0]);
  assert.equal(getCard('CS1-001'), a[0]);
  assert.equal(getCard('missing-id'), null);
});
test('query arrays cannot mutate the internal database and nested records are immutable', () => {
  const cards = allCards();
  cards.pop();
  assert.equal(allCards().length, 550);
  assert(Object.isFrozen(getCard('CS1-001')));
  assert(Object.isFrozen(getCard('CS1-001').subtypes));
  assert.throws(() => { getCard('CS1-001').name = 'Changed'; }, TypeError);
});
test('case-insensitive name, identifier and rules-text search', () => {
  assert(searchCards('sOrA').some(c => c.id === 'CS1-001'));
  assert.deepEqual(searchCards('cs1-201').map(c => c.id), ['CS1-201']);
  assert(searchCards('Momentum').every(c => JSON.stringify(c).toLowerCase().includes('momentum')));
  assert.equal(searchCards('absent-from-every-card-99999').length, 0);
});
test('franchise, type, rarity and subtype filters compose', () => {
  const chosen = getCard('CS1-001');
  const result = searchCards('', { franchise: chosen.franchise, type: 'character', rarity: chosen.rarity, subtype: 'sword wielder' });
  assert(result.includes(chosen));
  assert(result.every(c => c.franchise === chosen.franchise && c.type === 'Character' && c.rarity === chosen.rarity && c.subtypes.includes('Sword Wielder')));
});
test('arrays use OR for categories and AND for subtypes/keywords', () => {
  const result = searchCards('', { franchise: ['Final Fantasy', 'Kingdom Hearts'], subtypes: ['Sword Wielder', 'Mage'] });
  assert(result.length > 0);
  assert(result.every(c => ['Final Fantasy', 'Kingdom Hearts'].includes(c.franchise) && c.subtypes.includes('Sword Wielder') && c.subtypes.includes('Mage')));
  assert(searchCards('', { keywords: ['once', 'turn'] }).every(c => /once/i.test(c.effect_text) && /turn/i.test(c.effect_text)));
});
test('exact resource component, range and total cost filters', () => {
  const result = searchCards('', { type: 'Equipment', cost: { light: 2, darkness: { min: 1, max: 3 }, max: 5 } });
  assert(result.length > 0);
  assert(result.every(c => c.cost.light === 2 && c.cost.darkness >= 1 && c.cost.darkness <= 3 && Object.values(c.cost).reduce((a, b) => a + b, 0) <= 5));
  assert(searchCards('', { cost: 0 }).every(c => Object.values(c.cost).every(n => n === 0)));
});
test('40 cards and 20 arsenal slots are accepted', () => {
  assert.deepEqual(validateDeck(legalFixture()), { valid: true, errors: [], mainCount: 40, equipmentSlots: 20, finisherCount: 0 });
});
test('60-card upper boundary is accepted; 39 and 61 are rejected', () => {
  const fixture = legalFixture();
  const extra = allCards().filter(c => c.deck === 'Main' && c.type !== 'Finisher').slice(40, 60).map(c => c.id);
  assert(validateDeck({ ...fixture, mainIds: [...fixture.mainIds, ...extra] }).valid);
  assert(!validateDeck({ ...fixture, mainIds: fixture.mainIds.slice(1) }).valid);
  assert(!validateDeck({ ...fixture, mainIds: [...fixture.mainIds, ...extra, extra[0]] }).valid);
});
test('transformations consume two slots, not one card-count slot', () => {
  const fixture = legalFixture(), form = allCards().find(c => c.transformation);
  const good = { ...fixture, equipmentIds: [...fixture.equipmentIds.slice(0, 18), form.id] };
  assert(validateDeck(good).valid);
  const bad = validateDeck({ ...fixture, equipmentIds: [...fixture.equipmentIds.slice(0, 19), form.id] });
  assert.equal(bad.equipmentSlots, 21);
  assert(!bad.valid);
});
test('copy limit is per exact ID and includes registrations in both decks', () => {
  const fixture = legalFixture(), id = fixture.mainIds[0];
  const exactlyThree = [...fixture.mainIds];
  exactlyThree[1] = id; exactlyThree[2] = id;
  assert(validateDeck({ ...fixture, mainIds: exactlyThree }).valid);
  const four = [...exactlyThree]; four[3] = id;
  assert(validateDeck({ ...fixture, mainIds: four }).errors.some(e => /exceeds three copies/.test(e)));
  const wrongZoneExtra = validateDeck({ ...fixture, mainIds: exactlyThree, equipmentIds: [id, ...fixture.equipmentIds.slice(1)] });
  assert(wrongZoneExtra.errors.some(e => /exceeds three copies/.test(e)));
});
test('Finisher total cap counts copies, even with distinct IDs', () => {
  const fixture = legalFixture(), finishers = allCards().filter(c => c.type === 'Finisher');
  const six = [...fixture.mainIds.slice(6), ...finishers.slice(0, 6).map(c => c.id)];
  assert(validateDeck({ ...fixture, mainIds: six }).valid);
  const seven = [...fixture.mainIds.slice(7), ...finishers.slice(0, 7).map(c => c.id)];
  assert(validateDeck({ ...fixture, mainIds: seven }).errors.some(e => /at most six Finishers/.test(e)));
});
test('wrong deck zones, unknown IDs, missing lists and slot underfill are rejected', () => {
  const fixture = legalFixture();
  assert(!validateDeck({ ...fixture, mainIds: [fixture.equipmentIds[0], ...fixture.mainIds.slice(1)] }).valid);
  assert(validateDeck({ ...fixture, mainIds: ['unknown', ...fixture.mainIds.slice(1)] }).errors.some(e => /Unknown card ID/.test(e)));
  assert(!validateDeck({ ...fixture, equipmentIds: fixture.equipmentIds.slice(1) }).valid);
  assert(!validateDeck().valid);
  const noStartingCharacter = allCards().filter(c => c.deck === 'Main' && c.type !== 'Character').slice(0, 40).map(c => c.id);
  assert(validateDeck({ ...fixture, mainIds: noStartingCharacter }).errors.some(e => /at least one nontransformed Character/.test(e)));
});
test('all imported sample deck registrations validate', () => {
  assert(importedDecks.length > 0);
  for (const deck of importedDecks) {
    const result = validateDeck({ mainIds: deck.main, equipmentIds: deck.arsenal });
    assert(result.valid, `${deck.name}: ${result.errors.join('; ')}`);
  }
});
test('source citations and attached status never imply redistribution approval', () => {
  const sourceOnly = getCard('CS1-004'), sourceOnlyArt = getArtwork(sourceOnly);
  assert.equal(sourceOnlyArt.src, null);
  assert.equal(sourceOnlyArt.placeholder, true);
  assert.match(sourceOnlyArt.label, /Roxas/);
  assert.equal(sourceOnlyArt.sourceUrl, sourceOnly.canonical_source.url);
  const approvedOriginal = getArtwork(getCard('CS1-001'));
  assert.match(approvedOriginal.src, /public[\\/]artwork[\\/]CS1-001\.jpg/i);
  assert.equal(approvedOriginal.placeholder, false);
  for (const card of harryPotterAnime.filter(c => c.artwork.redistribution_approved)) {
    const art = getArtwork(getCard(card.id));
    assert.equal(art.placeholder, false);
    assert.match(art.src, /public[\\/]artwork[\\/]HPAN-/i);
  }
});
test('remote and nonexistent local images remain placeholders even with claimed approval', () => {
  const sora = getCard('CS1-001');
  for (const asset_path of ['https://example.com/image.png', '//example.com/image.png', '../secret.png', '/missing-artwork.png']) {
    const card = { ...sora, artwork: { ...sora.artwork, asset_path, redistribution_approved: true } };
    assert.equal(getArtwork(card).src, null);
    assert.equal(getArtwork(card).placeholder, true);
  }
  assert.equal(getArtwork(null).placeholder, true);
});
