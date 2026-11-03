import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const output = new URL('../data/sets/harry-potter-anime.json', import.meta.url);
const franchise = 'Harry Potter (Anime)';
const setName = 'Harry Potter (Anime)';
const names = [
  'Harry Potter, Precise Disarming',
  'Harry Potter, Keeper of the Old Ward',
  'Harry Potter, Patronus at Dusk',
  'Draconia Malfoy, Slytherin Prodigy',
  'Draconia Malfoy, Emerald Counterspell',
  'Draconia Malfoy, Calculated Reposition',
  'Harry & Draconia, Rivalry in Motion',
  'Harry & Draconia, Shared Spellline',
  'Hermione Granger, Library Strategist',
  'Hermione Granger, First to the Answer',
  'Ron Weasley, Loyal Interceptor',
  "Ron Weasley, Knight's Gambit",
  'Hermione & Ron, Study Group',
  'Voldemort, Horcrux Anchor',
  "Voldemort, the Dark Lord's Return",
  "Albus Dumbledore, Headmaster's Plan",
  'Severus Snape, Double Agent',
  'Luna Lovegood, Unexpected Clarity',
  'Neville Longbottom, Courage Blossoms',
  'Ginny Weasley, Fast Counter',
  'Cedric Diggory, Fair Duelist',
  'Rubeus Hagrid, Keeper of Creatures',
  'Elder Wand',
  "Harry's Holly Wand",
  "Draconia's Slytherin Wand",
  'Invisibility Cloak',
  'Nimbus Racing Broom',
  "Marauder's Map",
  'Time-Turner',
  'Sword of Gryffindor',
  'Felix Felicis Vial',
  'Basilisk Fang',
  'Expelliarmus: Disarming Charm',
  'Protego: Shield Charm',
  'Accio: Summoning Charm',
  'Expecto Patronum',
  "Hermione's Counter-Research",
  "Dumbledore's Army Drill",
  'Horcrux Trace',
  'Room of Requirement',
  'Finite Incantatem',
  'Protego at the Last Moment',
  'Apparition Break',
  'Red-and-Emerald Counterchain',
  'Felix Felicis Twist',
  'Stupefy: Chain Stop',
  'Patronus Stand',
  'Twin Wands: Red & Emerald Convergence',
  'Sundering the Horcrux',
  'Hogwarts Great Hall Rally',
];

const characterData = [
  ['Once per turn, when an enemy Character becomes the target of an Ability you control: you may pay 1 Momentum. If you do, that Ability cannot be interrupted by the next Speed Ability this Menu.', 'Reactive spell protection; rewards timing Harry after a target is announced.', 6500, 15500, ['Warrior','Mage','Wand Wielder','Wizard','Gryffindor Student'], ['Harry Potter','Wand Combo'], 'AI'],
  ['Once per turn, after this Character joins an Attack Chain: if you activated a Speed Ability earlier this turn, reveal the top 2 cards of your Main Deck. Add an Ability among them to your hand and put the rest on the bottom in any order.', 'Turns a response into a small, capped hand-selection engine.', 6000, 15000, ['Mage','Wand Wielder','Wizard','Gryffindor Student'], ['Harry Potter','Speed Spell'], 'AI'],
  ['Once per turn, when an allied Character would be defeated by effect damage: you may discard an Ability. If you do, prevent that defeat and put that Character on top of its owner’s Main Deck after this Menu resolves.', 'A costly rescue that converts a card from hand into delayed recovery.', 5500, 16000, ['Guardian','Mage','Wand Wielder','Wizard','Gryffindor Student'], ['Harry Potter','Protection'], 'AI'],
  ['Once per turn, when you add an allied Character to Party from your hand: look at the top 3 cards of your Main Deck. You may reveal a Speed Ability among them and put it into your hand; put the rest on the bottom in any order.', 'The Slytherin planner turns deployment into a bounded response setup.', 5500, 14000, ['Tactician','Mage','Wand Wielder','Witch','Slytherin Student'], ['Draconia Malfoy','Wand Combo','Slytherin'], 'AI'],
  ['Once per turn, when an opponent activates a Speed Ability in a Menu that targets exactly one of your Characters: you may pay 1 Darkness. If you do, change that Ability’s target to this Character, if legal.', 'A targeted redirect that spends Darkness and requires a legal target.', 5000, 13500, ['Tactician','Mage','Wand Wielder','Witch','Slytherin Student'], ['Draconia Malfoy','Protection','Slytherin'], 'AI'],
  ['Once per turn, after you resolve an Ability that moved a card from your Deck to your hand: you may put one card from your hand on the bottom of your Main Deck. If you do, gain 1 Momentum.', 'Trades a card for a capped Momentum burst after deck-to-hand setup.', 5000, 14000, ['Tactician','Mage','Wand Wielder','Witch','Slytherin Student'], ['Draconia Malfoy','Deck Setup','Slytherin'], 'AI'],
  ['Once per turn, when you activate an Ability while both Harry Potter and Draconia Malfoy are in your Party: after that Menu resolves, choose one of them. Its next Attack Chain this turn costs 1 less Momentum, to a minimum of 1.', 'A pair card that converts a shared spell into a limited chain discount.', 6000, 15000, ['Warrior','Mage','Wand Wielder','Wizard','Witch','Human'], ['Harry Potter','Draconia Malfoy','Pair Combo'], 'AI'],
  ['Once per turn, when an opponent activates a Speed Ability: if Harry Potter and Draconia Malfoy are both in your Party, you may discard one card. If you do, draw one card after that Menu resolves, then gain 1 Light or 1 Darkness.', 'A pair-based hand filter that rewards response timing and costs a discard.', 5000, 15000, ['Support','Mage','Wand Wielder','Wizard','Witch','Human'], ['Harry Potter','Draconia Malfoy','Pair Combo'], 'AI'],
  ['Once per turn, when you look at or reveal cards from the top of your Main Deck: you may reveal an Ability among them and put it into your hand. Put the remaining revealed cards on the bottom in any order.', 'Reliable, once-per-turn spell selection without unrestricted tutoring.', 5000, 14500, ['Tactician','Mage','Wand Wielder','Witch','Ravenclaw Student'], ['Hermione Granger','Research'], 'pending'],
  ['Once per turn, during your Main Phase: reveal the top 4 cards of your Main Deck. Add one Equipment or Speed Ability among them to your hand; put the rest on the bottom in any order.', 'A deeper but narrower setup effect that costs a full Main Phase action.', 4500, 13000, ['Tactician','Mage','Wand Wielder','Witch','Gryffindor Student'], ['Hermione Granger','Research','Deck Setup'], 'pending'],
  ['Once per turn, when this Character survives as an Allied Guard: discard one card, then gain 1 Momentum and draw one card.', 'Card-neutral guard payoff with a meaningful discard and survival condition.', 5000, 16500, ['Guardian','Warrior','Wizard','Gryffindor Student'], ['Ron Weasley','Guard Combo'], 'pending'],
  ['Once per turn, when an allied Character is chosen by an enemy Ability: you may pay 1 Light. If you do, Ron becomes that Ability’s target instead, if legal; after it resolves, draw one card if Ron survived.', 'Protects a teammate by redirecting one legal effect and rewards survival.', 5500, 16000, ['Guardian','Warrior','Wizard','Gryffindor Student'], ['Ron Weasley','Protection'], 'pending'],
  ['Once per turn, when you activate an Ability while Harry Potter or Draconia Malfoy is in your Party: you may discard one card. If you do, draw one card, then gain 1 Momentum if both are present.', 'A filtering bridge into the set’s central pair strategy.', 4500, 14500, ['Support','Mage','Wand Wielder','Wizard','Witch','Human'], ['Hermione Granger','Ron Weasley','Harry Potter','Draconia Malfoy','Pair Combo'], 'pending'],
  ['Once per turn, when an opposing Character is returned from the battlefield to a Deck by an effect: gain 1 Darkness. If you control a Horcrux, you may also put the top card of your Main Deck into your hand, then discard one card.', 'Darkness engine with a conditional, card-neutral Horcrux filter.', 7000, 17000, ['Mage','Wand Wielder','Wizard','Dark Wizard','Death Eater'], ['Voldemort','Horcrux'], 'pending'],
  ['Once per turn, when this Character would leave the battlefield: if you control a Horcrux Equipment, you may pay 2 Darkness. If you do, return this card to your hand instead.', 'A costly return-to-hand line that needs separate Horcrux setup.', 7500, 18000, ['Berserker','Mage','Wand Wielder','Wizard','Dark Wizard','Death Eater'], ['Voldemort','Horcrux','Recursion'], 'pending'],
  ['Once per turn, when an opponent interrupts one of your Abilities: look at the top 3 cards of your Main Deck. You may put one Ability among them on top and the rest on the bottom in any order.', 'Turns an interrupted spell into future setup without negating the answer.', 4500, 15000, ['Tactician','Mage','Wand Wielder','Wizard'], ['Dumbledore','Spell Sequencing'], 'pending'],
  ['Once per turn, when an enemy Ability targets exactly one allied Character: you may discard an Ability. If you do, that Ability’s controller may choose a different legal target; if they cannot, negate that Ability.', 'A conditional soft redirect with discard cost and fallback negation.', 5000, 15000, ['Tactician','Mage','Wand Wielder','Wizard','Slytherin Student'], ['Snape','Disruption'], 'pending'],
  ['Once per turn, after you put a card from your Deck on the bottom: gain 1 Light. If that card was an Ability, you may reveal the top card of your Deck and put it on the bottom too.', 'Small Light generation tied to deliberate deck filtering.', 4000, 13000, ['Support','Mage','Wand Wielder','Witch','Ravenclaw Student'], ['Luna','Light Engine','Deck Setup'], 'pending'],
  ['Once per turn, when an allied Character is defeated: gain 1 Momentum. If you control a Gryffindor Student, you may return one Ability from your discard pile to the bottom of your Main Deck.', 'Converts a setback into Momentum and limited non-hand recursion.', 5000, 15500, ['Warrior','Guardian','Mage','Wand Wielder','Wizard','Gryffindor Student'], ['Neville','Recovery'], 'pending'],
  ['Once per turn, after you activate a Speed Ability: gain 1 Light. If Harry Potter or Draconia Malfoy is in your Party, the next Speed Ability you activate this turn costs 1 less Momentum, to a minimum of 0.', 'Speed-chain support with a bounded resource gain and discount.', 5500, 14500, ['Warrior','Mage','Wand Wielder','Witch','Gryffindor Student'], ['Ginny','Speed Spell','Light Engine'], 'pending'],
  ['Once per turn, when this Character joins an Attack Chain with an allied Character from another franchise: gain 1 Momentum after that Chain resolves. If the enemy spent a Speed Ability in that Menu, draw one card, then discard one card.', 'Cross-franchise chain reward with conditional card-neutral filtering.', 5500, 15000, ['Warrior','Guardian','Wizard','Hufflepuff Student'], ['Cedric','Crossover Chain'], 'pending'],
  ['Once per turn, when you add a Magical Creature from your hand to Party: reveal the top 3 cards of your Main Deck. Add one Ability among them to your hand; put the rest on the bottom in any order.', 'Creature deployment becomes capped spell selection.', 4500, 17500, ['Guardian','Support','Wizard','Gryffindor Student'], ['Hagrid','Magical Creature','Deck Setup'], 'pending'],
];

const equipmentData = [
  ['Once per turn, when you activate an Ability: you may pay 1 Momentum. If you do, look at the top 2 cards of your Main Deck and put them back in either order.', ['Mage'], [], 2, { light: 2, darkness: 2, momentum: 0 }, ['Spell Sequencing'], 'pending'],
  ['Once per turn, when its wielder activates a Speed Ability: if Harry Potter is in your Party, gain 1 Light. This can trigger only once per turn.', ['Wand Wielder'], [], 1, { light: 1, darkness: 0, momentum: 0 }, ['Harry Potter','Speed Spell'], 'pending'],
  ['Once per turn, after its wielder changes the target of an enemy effect: gain 1 Darkness. This can trigger only once per turn.', ['Wand Wielder','Slytherin Student'], [], 1, { light: 0, darkness: 1, momentum: 0 }, ['Draconia Malfoy','Slytherin'], 'pending'],
  ['Once per turn, when an enemy Ability targets its wielder: you may pay 1 Light. If you do, that Ability cannot choose this wielder as its target.', ['Mage'], ['Tactician','Assassin'], 2, { light: 1, darkness: 1, momentum: 0 }, ['Protection','Crossover Equipment'], 'pending'],
  ['When its wielder joins an Attack Chain, you may pay 1 Momentum. If you do, search your Main Deck for a Speed Ability, reveal it, put it on the bottom of your Main Deck, then shuffle. The next Speed Ability you activate this turn costs 1 less Momentum.', ['Seeker'], ['Archer','Warrior'], 1, { light: 1, darkness: 0, momentum: 1 }, ['Harry Potter','Speed Spell'], 'pending'],
  ['Once per turn, when you look at cards from your Deck: you may reveal one additional card, then put one card from your hand on the bottom of your Main Deck.', ['Tactician'], [], 1, { light: 1, darkness: 1, momentum: 0 }, ['Deck Setup'], 'pending'],
  ['Once per turn, when an opponent activates their second card in one Menu: you may pay 1 Momentum. If you do, look at the top 3 cards of your Main Deck and put them back in any order.', ['Mage','Tactician'], [], 1, { light: 1, darkness: 1, momentum: 1 }, ['Menu Control','Crossover Equipment'], 'pending'],
  ['Once per turn, after its wielder guards: if a Character was defeated in that combat, return one Ability from your discard pile to the bottom of your Main Deck.', ['Sword Wielder'], ['Gryffindor Student','Warrior'], 2, { light: 2, darkness: 1, momentum: 0 }, ['Recovery'], 'pending'],
  ['When you activate your second card in a Menu, you may put one card from your hand on the bottom of your Main Deck. If you do, gain 1 Light or 1 Darkness.', ['Support','Tactician'], [], 1, { light: 1, darkness: 1, momentum: 0 }, ['Resource Engine','Menu Sequencing'], 'pending'],
  ['Once per turn, when an Ability targets an opposing Character with a Horcrux attached: you may discard this Equipment. If you do, negate that Ability and put the Horcrux on the bottom of its owner’s Deck.', ['Assassin'], ['Sword Wielder','Gunner'], 2, { light: 0, darkness: 2, momentum: 1 }, ['Horcrux','Disruption','Crossover Equipment'], 'pending'],
];

const abilityData = [
  ['Interrupt an Ability that targets exactly one allied Character. Its controller may pay 1 Momentum; if they do, that Ability is not interrupted. Otherwise negate it.', { light: 1, darkness: 0, momentum: 1 }, ['Wand Wielder'], 'During a Menu, after an Ability chooses its target and before it resolves.', 'One targeted enemy Ability.', ['Harry Potter','Disruption'], 'Rare'],
  ['Choose an allied Character. Prevent the next 4000 effect damage it would take before the start of your next turn. If that Character is Harry or Draconia, gain 1 Light.', { light: 1, darkness: 0, momentum: 1 }, [], 'Your Main Phase; empty Menu.', 'One allied Character.', ['Protection','Harry Potter','Draconia Malfoy'], 'Common'],
  ['Search your Main Deck for an Equipment with printed cost 2 or less, reveal it, and put it into your hand. Shuffle. If Harry or Draconia is in your Party, gain 1 Momentum.', { light: 1, darkness: 0, momentum: 0 }, ['Mage'], 'Your Main Phase; empty Menu.', 'One Equipment from your Main Deck.', ['Search','Harry Potter','Draconia Malfoy'], 'Uncommon'],
  ['Choose an allied Character. Heal 3000 HP. If you control a Wand Wielder, gain 1 Light; if the opponent controls a Darkness resource, you may also put one card from your hand on the bottom of your Main Deck to draw one card.', { light: 1, darkness: 0, momentum: 1 }, ['Mage'], 'Your Main Phase; empty Menu.', 'One allied Character.', ['Healing','Light Engine','Hand Filtering'], 'Rare'],
  ['Reveal the top 5 cards of your Main Deck. Add one Ability among them to your hand; put the rest on the bottom in any order. If you control Hermione, reveal 6 instead.', { light: 0, darkness: 0, momentum: 1 }, [], 'Your Main Phase; empty Menu.', 'One Ability among the revealed cards.', ['Hermione Granger','Deck Setup','Search'], 'Uncommon'],
  ['Choose a Character with printed cost 2 or less in your hand and add it to Party. If Harry and Draconia are both in your Party, gain 1 Momentum after this Ability resolves.', { light: 1, darkness: 0, momentum: 1 }, [], 'Your Main Phase; empty Menu.', 'One Character in your hand.', ['Party Deployment','Harry Potter','Draconia Malfoy'], 'Rare'],
  ['Reveal the top 4 cards of your Main Deck. You may add one Horcrux or one Speed Ability among them to your hand; put the rest on the bottom in any order. If Voldemort is in your Party, gain 1 Darkness.', { light: 0, darkness: 1, momentum: 0 }, [], 'Your Main Phase; empty Menu.', 'One Horcrux or Speed Ability among the revealed cards.', ['Voldemort','Horcrux','Deck Setup'], 'Uncommon'],
  ['Put one card from your hand on the bottom of your Main Deck. Search your Main Deck for a Character with a different name and printed cost 1 or less, reveal it, and put it into your hand. Shuffle. If you control Hermione, you may add an Ability instead.', { light: 1, darkness: 0, momentum: 1 }, ['Tactician'], 'Your Main Phase; empty Menu.', 'One eligible Character or Ability from your Main Deck.', ['Search','Party Setup','Crossover'], 'Rare'],
];

const speedData = [
  ['When an Ability resolves, choose one effect on it that targets an allied Character. That effect does not apply to that Character. If Draconia is in your Party, gain 1 Darkness.', { light: 0, darkness: 1, momentum: 1 }, 'After an Ability chooses targets and before it resolves.', ['One targeted effect on an allied Character.'], ['Draconia Malfoy','Negation'], 'Rare'],
  ['When an opposing card effect would deal damage to an allied Character, prevent up to 4000 of that damage. If you control a Guardian, draw one card then discard one card.', { light: 1, darkness: 0, momentum: 1 }, 'After damage is assigned and before it is applied.', ['One allied Character.'], ['Protection','Guardian'], 'Common'],
  ['When an enemy Ability targets exactly one allied Character, return that Character to its owner’s hand after the Ability resolves. If it left the battlefield this way, its Equipment returns to its owner’s Equipment/Transformation Deck.', { light: 0, darkness: 0, momentum: 2 }, 'After the target is chosen and before the Ability resolves.', ['One allied Character.'], ['Evade','Recovery'], 'Rare'],
  ['When an opponent activates a Speed Ability: if Harry and Draconia are both in your Party, discard one card. If you do, negate that Speed Ability unless its controller pays 1 additional Momentum.', { light: 1, darkness: 0, momentum: 1 }, 'In response to an opposing Speed Ability, before it resolves.', ['One opposing Speed Ability.'], ['Harry Potter','Draconia Malfoy','Counterspell'], 'Mythic'],
  ['When a card is added to an opponent’s hand from their Deck: gain 1 Light. If you control a Support Character, look at the top card of your Main Deck; you may put it on the bottom.', { light: 0, darkness: 0, momentum: 1 }, 'After the opponent’s Deck-to-hand effect resolves.', ['No chosen target.'], ['Resource Engine','Deck Setup'], 'Uncommon'],
  ['When an opposing Character joins an Attack Chain: that Character cannot join another Attack Chain this turn. If you control a Gryffindor Student, gain 1 Momentum after the Menu resolves.', { light: 0, darkness: 1, momentum: 1 }, 'After the attacker is declared and before the response Menu closes.', ['One opposing Character in that Attack Chain.'], ['Attack Disruption','Gryffindor'], 'Rare'],
];

const finisherData = [
  ['Choose an opposing Character. Deal 7000 damage to it. If it survives, its controller may discard a card; if they do not, put it on top of its owner’s Main Deck. If Harry is in your Party, heal one allied Character 2000 HP.', { light: 3, darkness: 0, momentum: 2 }, ['Mage'], 'Your Main Phase; empty Menu; once per turn.', ['One opposing Character.'], ['Harry Potter','Removal','Patronus'], 'Mythic'],
  ['Requires both Harry Potter and Draconia Malfoy in your Party. Interrupt one opposing Ability or Speed Ability. Its controller may pay 2 Momentum; if they do, the card resolves with one fewer chosen target, if any. Then gain 1 Light and 1 Darkness.', { light: 2, darkness: 2, momentum: 2 }, [], 'During a Menu, after an opposing effect chooses targets and before it resolves.', ['One opposing Ability or Speed Ability.'], ['Harry Potter','Draconia Malfoy','Pair Combo','Counterspell'], 'Mythic'],
  ['Requires Voldemort in your Party. Choose an opposing Character and one Horcrux in any discard pile. Put the Horcrux on the bottom of its owner’s Deck; if you do, deal 8000 damage to that Character and gain 2 Darkness.', { light: 0, darkness: 4, momentum: 2 }, ['Dark Wizard'], 'Your Main Phase; empty Menu; once per turn.', ['One opposing Character and one Horcrux in a discard pile.'], ['Voldemort','Horcrux','Removal'], 'Mythic'],
  ['Choose up to two allied Characters. Each may join one Attack Chain this turn without paying its first Momentum cost. After that Chain resolves, if Harry or Draconia participated, gain 1 Momentum and draw one card, then discard one card.', { light: 2, darkness: 1, momentum: 3 }, [], 'Your Main Phase; empty Menu; once per turn.', ['Up to two allied Characters.'], ['Hogwarts','Crossover Chain','Resource Engine'], 'Rare'],
];

const images = new Map([
  [1, 'artwork/HPAN-001.png'], [2, 'artwork/HPAN-002.png'], [3, 'artwork/HPAN-003.png'],
  [4, 'artwork/HPAN-004.png'], [5, 'artwork/HPAN-005.png'], [6, 'artwork/HPAN-006.png'],
  [7, 'artwork/HPAN-007.png'], [8, 'artwork/HPAN-008.png'],
]);
const rarities = ['Common', 'Uncommon', 'Rare', 'Mythic'];
const cards = [];

function addCard(i, type, data) {
  const id = `HPA-${String(i).padStart(3, '0')}`;
  const imagePath = images.get(i);
  const record = {
    id, set: setName, set_code: 'HPA', name: names[i - 1], franchise, game: 'Harry Potter (Anime) · Fan-made alternate-universe set', type,
    subtypes: data.subtypes || [], affiliations: data.affiliations || [], rarity: data.rarity || rarities[(i * 7 + 1) % rarities.length],
    cost: data.cost || { light: 0, darkness: 0, momentum: 0 }, statistics: data.statistics || null,
    effect_text: data.effect_text, timing: data.timing || (type === 'Speed Ability' ? 'Response Menu timing; see effect text.' : 'Your Main Phase; empty Menu.'),
    requirements: data.requirements || { all: [], any: [] }, targets: data.targets || 'Only the Characters or cards specified in effect text; all printed controller, zone, subtype and timing restrictions apply.',
    archetypes: data.archetypes || [], strategic_purpose: data.strategic_purpose,
    balance_notes: data.balance_notes || 'New card text is drafted for the 50-card set. Engine behavior, balance and gameplay remain unverified; this card is not marked playtested.',
    canonical_source: data.canonical_source || { url: 'https://www.wizardingworld.com/', reference: data.source || 'Harry Potter setting; fan-made anime presentation. No official anime adaptation is implied.' },
    artwork: imagePath ? {
      status: 'attached', match_kind: 'AI-generated original fan art', description: 'Distinct AI-generated illustration made for this fan-made card set.',
      subject: names[i - 1], asset_path: imagePath, local_asset_path: imagePath, credit: 'AI-generated for the Crossover TCG project', redistribution_permission: 'AI-generated for this project', redistribution_approved: true,
    } : { status: 'pending', description: 'Unique artwork pending; no shared image is assigned.', subject: names[i - 1] },
    status: { designed: true, mechanically_validated: false, balance_reviewed: false, playtested: false, structurally_validated: true, rule_reviewed: false },
    deck: type === 'Equipment' ? 'Equipment/Transformation' : 'Main', slots: data.slots || 1,
    transformation: null, combat_subtypes: data.combat_subtypes || [], species_nature: data.species_nature || [],
    franchise_subtypes: data.franchise_subtypes || [], form_tags: [],
  };
  cards.push(record);
}

for (let index = 0; index < characterData.length; index++) {
  const [effect_text, strategic_purpose, atk, hp, subtypes, archetypes, art] = characterData[index];
  const i = index + 1;
  addCard(i, 'Character', {
    effect_text, strategic_purpose, statistics: { atk, hp }, subtypes,
    combat_subtypes: subtypes.filter(x => ['Sword Wielder','Mage','Healer','Berserker','Warrior','Assassin','Martial Artist','Summoner','Guardian','Archer','Spear Wielder','Support','Tactician','Gunner'].includes(x)),
    species_nature: subtypes.includes('Human') || subtypes.includes('Wizard') || subtypes.includes('Witch') ? ['Human'] : subtypes.includes('House Elf') ? ['House Elf'] : [],
    franchise_subtypes: subtypes.filter(x => !['Sword Wielder','Dual Wielder','Gunner','Healer','Berserker','Warrior','Mage','Assassin','Martial Artist','Summoner','Guardian','Archer','Spear Wielder','Support','Tactician','Human'].includes(x)),
    archetypes, rarity: i <= 8 ? (i === 7 || i === 8 ? 'Mythic' : 'Rare') : undefined,
    requirements: { all: [], any: [] }, source: names[i - 1],
  });
}

for (let index = 0; index < equipmentData.length; index++) {
  const [effect_text, all, any, slots, cost, archetypes, art] = equipmentData[index];
  const i = 23 + index;
  addCard(i, 'Equipment', { effect_text, strategic_purpose: `Crossover Equipment: supports ${archetypes.join(', ')} while creating a distinct utility line.`, requirements: { all, any }, slots, cost, archetypes, rarity: i === 23 ? 'Mythic' : undefined, source: names[i - 1] });
}

for (let index = 0; index < abilityData.length; index++) {
  const [effect_text, cost, all, timing, targets, archetypes, rarity] = abilityData[index];
  const i = 33 + index;
  addCard(i, 'Ability', { effect_text, cost, requirements: { all, any: [] }, timing, targets, archetypes, rarity, strategic_purpose: `Main-phase combo piece for ${archetypes.join(', ')}; creates interaction beyond a stat change.`, source: names[i - 1] });
}

for (let index = 0; index < speedData.length; index++) {
  const [effect_text, cost, timing, targets, archetypes, rarity] = speedData[index];
  const i = 41 + index;
  addCard(i, 'Speed Ability', { effect_text, cost, timing, targets: targets.join(' '), archetypes, rarity, strategic_purpose: `Response-window interaction for ${archetypes.join(', ')}; offers counterplay and combo timing.`, source: names[i - 1] });
}

for (let index = 0; index < finisherData.length; index++) {
  const [effect_text, cost, all, timing, targets, archetypes, rarity] = finisherData[index];
  const i = 47 + index;
  addCard(i, 'Finisher', { effect_text, cost, requirements: { all, any: [] }, timing, targets: targets.join(' '), archetypes, rarity, strategic_purpose: `High-cost closing line with interaction and counterplay for ${archetypes.join(', ')}.`, source: names[i - 1] });
}

if (cards.length !== 50 || new Set(cards.map(card => card.id)).size !== 50) throw new Error('The Harry Potter (Anime) set must contain 50 unique card records.');
for (const card of cards) {
  if (!card.name.startsWith('Draconia') && /Draco Malfoy/i.test(card.name)) throw new Error(`Forbidden character naming: ${card.name}`);
  if (card.name.startsWith('Draconia') && !card.artwork.local_asset_path && card.type === 'Character') card.artwork.status = 'pending';
}
await mkdir(new URL('../data/sets/', import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(cards, null, 2)}\n`);
const registeredSet = [{ code: 'HPA', name: setName, file: 'data/sets/harry-potter-anime.json', card_count: cards.length, franchise, kind: 'fan-made anime-style alternate universe' }];
await writeFile(new URL('../data/sets/registry.json', import.meta.url), `${JSON.stringify(registeredSet, null, 2)}\n`);
const artworkManifest = [];
for (const card of cards.filter(item => item.artwork.local_asset_path)) {
  const bytes = await readFile(new URL(`../public/${card.artwork.local_asset_path}`, import.meta.url));
  artworkManifest.push({ card_id: card.id, card_name: card.name, file: `public/${card.artwork.local_asset_path}`, creator: 'AI-generated for the Crossover TCG project', permission: 'Project-generated asset; no third-party source art used', sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(new URL('../data/source/harry-potter-anime-artwork-manifest.json', import.meta.url), `${JSON.stringify(artworkManifest, null, 2)}\n`);
const decksUrl = new URL('../data/source/decks.json', import.meta.url);
const decks = JSON.parse(await readFile(decksUrl, 'utf8'));
const sampleName = 'Scarlet & Emerald Counterspell';
const sampleDeck = {
    name: sampleName,
    starting_main: 'HPA-001',
    main: [1,2,3,4,5,6,7,8,9,10,11,12,13].flatMap(cardNo => Array(cardNo === 14 ? 1 : 3).fill(`HPA-${String(cardNo).padStart(3, '0')}`)).concat('HPA-014'),
    arsenal: [
      ...Array(2).fill('HPA-023'), 'HPA-024', 'HPA-025','HPA-026','HPA-027','HPA-028','HPA-029',
      ...Array(2).fill('HPA-030'), 'HPA-031', ...Array(2).fill('HPA-032'),
    ],
  };
const sampleIndex = decks.findIndex(deck => deck.name === sampleName);
if (sampleIndex < 0) decks.push(sampleDeck);
else decks[sampleIndex] = sampleDeck;
await writeFile(decksUrl, `${JSON.stringify(decks, null, 2)}\n`);
console.log(`Wrote ${cards.length} cards to ${output.pathname}`);
