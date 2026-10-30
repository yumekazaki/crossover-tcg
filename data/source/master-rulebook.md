# Crossover TCG — Master Rulebook
Version 1.0.0 design edition • 2026-10-30

This is the single authoritative playable design edition. Historical decisions are preserved in sections 1–11; section 12 explicitly completes missing foundations and overrides their completion placeholders. New designer decisions are not represented as historical approvals. Exact recovered statements are in the Existing Rules Registry. Tournament balance and human playtesting remain separate acceptance gates.

## 1. Objective and card types
Each player starts at **15 life**. A player at 0 life loses. A required draw from an empty Main Deck immediately loses, unless card text explicitly provides an exception.

The five primary card types are **Character, Equipment, Ability, Speed Ability, Finisher**. Transformations are Character cards, not a sixth type. Characters have ATK and maximum/current HP in RPG-scale thousands; HP generally substantially exceeds ATK. Affiliation, universal combat subtypes, franchise-specific subtypes, nature/species, and transformation classification remain separate database properties. Multiple applicable subtypes are allowed.

A card's explicit exception takes precedence over a general rule. Explicit override wording takes precedence when equally specific effects conflict; otherwise use normal rules and actual resolution order. Avoid broad override text in the first set.

## 2. Decks and setup
Main Deck: **40–60 cards**. Equipment/Transformation Deck: **20 slots**. Maximum **three copies of the same card**, applying to both decks. At most **six total Finisher cards** in the Main Deck. Select starting Main from registered Main Deck before shuffling/drawing, as detailed in D001.

Starting hand: **five cards**. Once, a player may take a partial mulligan: return any number and draw the same number. Shuffle returned cards back before replacements, as detailed in D002.

The battlefield has **seven Character Zones** per player: one **Center Zone** and six **Party Zones**. The Character in Center is the Main Character; other deployed Characters are Party Members. The **Continue? Zone** is the discard/graveyard destination.

Starting Momentum was set at **five** in the original resource proposal. The accompanying proposed cap of fourteen was later explicitly superseded: **Momentum has no universal maximum**. D001 completes initial Light/Darkness at zero and the setup sequence.

## 3. Turn and resources
The established phases include beginning-of-turn, Main Phase, Battle Phase, and end-of-turn; exact checkpoint ordering is specified in D003.

At the beginning of each own turn, immediately gain **five Momentum**, before beginning-of-turn triggers are collected. This supersedes older gains of one and three. Draw **one card automatically** each turn. Gain **one Light and one Darkness each own turn**. Light and Darkness pay Equipment and Transformation costs. D001/D003 establish zero initial Light/Darkness and uncapped carryover. Every legal Speed Ability activation grants **one Momentum**, including repeated legal activations; pending gains cannot pay an activation cost until actually received.

There is no universal hand-size maximum. Drawing is not a voluntary standard action; additional draws require explicit rules/effects. Hands are hidden; hand counts are public. Players cannot freely inspect or search their Main Deck.

## 4. Deployment, switching, and Party Swap
A player with a Main Character may **Add to Party once per own turn**. Effects can permit additional calls. Newly deployed or revived Party Members may use eligible Specials and attack immediately under normal attack limits.

One free Main Character switch is allowed each own Main Phase; effects may grant more or different timing. Center grants **+13,000 maximum HP**. Leaving Center subtracts 13,000 current HP, but never reduces current HP below one through that subtraction. Entering Center increases currentHP by13000 as well (D006).

**Party Swap:** own Main Phase, pay **six Momentum**, return up to **two untransformed Party Members** to hand and clear their damage. It may be used repeatedly if paid. Party Swap triggers eligible leave-battlefield/return-to-hand triggers. Gear returns to its original owner's Equipment/Transformation Deck; refund half each printed Light/Darkness component, rounded down, except a component of one refunds one. Refund occurs only through Party Swap.

Ordinary effects/actions controlled by a Character's own player that return it to hand/deck or send it to Continue? require that Character to be at full HP. Party Swap and the explicit Transformation procedure are exceptions. Opposing removal effects can affect damaged Party Members.

## 5. Combat
A Character normally successfully attacks **once each turn**, including Chain participation. Failed attacks do not consume that usage. The Main Character has one free attack; one Party Member has a separate free attack allowance. These allowances are shared across the turn and are not reset by transformation.

During Battle Phase, declare the original attacker, an opposing Character target, and all additional eligible Chain attackers, paying **two Momentum per extra attacker upfront**. A Character already used to attack cannot participate again unless an effect expressly permits it. Chain Attack participants cannot be added after responses finish.

The defender may use **Allied Guard**: the original target is included automatically; each additional eligible Party Member assisting costs **two Momentum** upfront. The Main Character cannot assist as a Party Member. Guards may assist multiple sequences in a turn if eligible and paid, and may attack and guard in the same turn. Each Character occupies only one position in a damage distribution. Statuses prevent only the actions they expressly restrict.

The attacker chooses offensive actions first, then the defender responds; both continue eligible responses through the Menu. All offensive/defensive effects resolve before damage calculation. **The complete Chain Attack resolves without interruption.** There are no responses between its participants.

Combine all participating attackers' resulting ATK damage and associated offensive damage, except effects expressly specifying separate targets/procedures. Divide this total as evenly as possible among the original target and remaining Allied Guards. **Assign the entire indivisible remainder to the original target.** This is the latest explicit formula, superseding per-attacker blocking and reduction-before-splitting procedures.

After initial distribution, eligible redirection resolves; redirected damage cannot be redirected again unless explicit text permits it. An ineligible receiving Character makes the redirection fail, leaving its original assignment. Then apply each recipient's own reductions/prevention. Damage cannot be negative; unused reduction is wasted. A protected original target remains in the distribution. Excess assigned damage never spills to other Characters.

Attack/guard participants that become ineligible before damage do not contribute. Costs are not refunded. If the original target ceases to be the same battlefield instance, no automatic retargeting occurs; the entire combined sequence fails without refund or automatic retargeting (D008).

Damage persists. Healing is capped at current maximum HP and excess healing is allowed but wasted. Healing cannot revive a defeated Character; revival needs explicit text and an available Party Zone. A normal revived Party Member cannot automatically occupy Center.

## 6. Defeat and life
Finalize all damage/redirection/reduction/prevention before defeat processing. Characters reaching zero HP in one event are defeated **simultaneously**. Defeat triggers cannot retroactively prevent those defeats unless expressly permitted.

A defeated Party Member goes to Continue?; a defeated untransformed Main Character revives at full HP as a new battlefield instance. Battle defeat of a Party Member costs its controller **one life** and grants its opponent **one Momentum**. Battle defeat of Main costs **two life** and grants the opponent **two Momentum**. A direct effect sending a Character to Continue? does not inflict life loss. Noncombat damage defeat gives no life loss/defeat Momentum (D009).

Attached Equipment returns to its original owner's Equipment/Transformation Deck on any battlefield departure, with no refund except Party Swap. Process resulting life/Momentum consequences and then eligible triggers.

## 7. Equipment
Equipment normally attaches during the owner's Main Phase; effects can permit other timing. D004 completes separate-deck access as a public open arsenal; this is a designer completion, not a historical approval claim.

Pay printed Light/Darkness and meet printed compatibility requirements at attachment. Requirements can use **AND** (all required) and **OR** (at least one in each OR group). Once legally attached, losing a required subtype **does not detach or deactivate** Equipment.

Compatible Equipment is unlimited, including duplicate copies; compatible stat bonuses and protections stack unless text says otherwise. There are no universal weapon/accessory slots. Each individual Equipment ability is once per turn unless text states otherwise. Usage is tracked on that Equipment for the whole turn and does not reset when control changes.

Equipment transfer between Characters needs explicit card text and checks new-host compatibility. Stolen Equipment checks the new controller's Character requirements; ownership remains unchanged. Control lasts as specified, and temporary control returns to original owner on expiry. Leaving the battlefield always returns Equipment to original owner's Equipment/Transformation Deck.

Voluntary unequipping is allowed in an established legal action window and sends Equipment to its designated owner destination. D005 defines own Main empty-Menu activation, with normal responses. Reattachment rechecks compatibility and repays costs.

Negating attachment prevents attachment, returns Equipment to the separate deck, and refunds nothing. Negating an attached Equipment's effects leaves it attached but suppresses effects/bonuses for the stated duration. Negating one Equipment ability leaves other effects intact. Equipment activated effects remain controlled by the activating player even if source control changes. Essential printed attachment/presence requirements are checked on resolution.

## 8. Transformations
Transformations require **specific versions of named base Characters**, printed resources and additional conditions. Both Main and Party Members can transform, remaining in their original zones. Transformations are locked to that zone: standard switching and Party Swap cannot move them. Forms cannot transform into other forms. Multiple transformations in a turn were allowed earlier, but later base-only requirements prevent form-to-form chains; reverting/restoring to a legal base is necessary before another transform.

Transformation restores full HP, removes temporary buffs/debuffs except explicit carryover, preserves completed attack usage and shared allowances, and transfers compatible Equipment. Incompatible gear returns to its owner's separate deck without refund. Losing a subtype after ordinary legal attachment does not detach gear, but the transformation procedure specifically checks compatibility.

**Transformed Characters cannot be removed by card effects.** Damage effects still work. Only effects controlled by the transformed Character's owner may end the transformation. No voluntary standard reversion exists.

A defeated transformed Party Member goes to Continue?. A defeated transformed Main sends its form to Continue? and restores **another existing copy of the exact original base version**, from any location, in Center. This restoration is mandatory and overrides ordinary location restrictions. At least one existing exact base copy is protected against becoming permanently unavailable while that form is Main. D011 specifies base underlay and second-copy reserve; D001 completes the tentative two-slot form weight.

## 9. Abilities, Specials, and Menu
Ability Cards normally activate from hand in own Main Phase. Speed Abilities activate from hand during either player's legal action windows, including initiating a Menu without another effect. Printed conditions and restrictions govern. Ordinary Ability/Speed cards have **no inherent resource cost**, only conditions; explicit exceptional costs are possible if printed and justified.

Character abilities are called **Character Specials**: Active (own Main Phase unless reactive/timed text), Triggered, Passive. Passives apply continuously without a Menu Select. Specials normally function on battlefield, with other zones requiring explicit text. Character Specials normally do not cost resources; rare powerful exceptions may. Activated Specials generally survive source departure unless an essential condition requires presence.

Each activated card/ability is a **Menu Select**. Eligible responses can respond to either player's Selects, including one's own. Multiple copies are permitted if independently legal, with no universal per-Menu limit. Turn player has first priority after actions and pending trigger processing. A pass can be followed by another response opportunity if the opponent adds a Select. After **two consecutive passes**, the Menu closes and resolves **backward**. Once resolution starts, no responses or new Selects can interrupt any part of that Menu.

Activation conditions are checked at activation unless wording expressly demands they remain true. Targets/essential resolution requirements are checked at resolution. Ignore illegal targets and resolve independent legal portions; no targets remaining means no target-dependent result. No automatic replacement targets.

Activation costs are paid immediately and require actual available resources. Unresolved resource effects cannot pay them. Negation/failure refunds nothing. Trigger costs are checked and paid at resolution; unpayable essential costs make dependent portions fail without partial payment. Independent legal instructions continue.

Ability and Speed Cards go to **Continue?** after resolution, even if effect-negated or no legal targets remain; activation-negated copies also go there. Usage restrictions remain consumed on activation/effect negation.

Activation Negation prevents successful activation. Effect Negation allows activation but prevents effects. Eligible negations can target pending Selects and be negated by eligible responses. Explicit protection scope governs; protection grants no automatic immunity beyond its text.

## 10. Trigger and delayed-effect reference
For simultaneous triggers: turn player places theirs first, then opponent; each chooses order of their own triggers. Menu resolves backward. Optional collection decisions are final; mandatory triggers are collected even without payable costs/legal targets. Source leaving does not erase a collected trigger. Use last-known battlefield information at the actual triggering event, including gear/buffs.

Triggers/delayed timings occurring during a resolving Menu are recorded immediately and processed only afterward. Each distinct timing event forms its own FIFO pending group; simultaneous event triggers share a Menu. New groups append after existing groups. Historical trigger eligibility/controller stays fixed unless printed ongoing conditions/explicit transfer apply.

Collected triggers/delayed effects can be explicitly transferred, modified, protected, suspended, or negated by eligible wording. Current controller makes future choices/pays future resolution costs/receives benefits unless printed otherwise. Original activating/triggering controller and event history remain recorded. Source control change alone does not transfer the effect.

Protection layers and suspensions operate independently with their own controllers, scopes, durations, and conditions. Suspended protection provides no protection in scope; its original duration continues running. It resumes only if time remains and no applicable suspension remains. Negated suspensions end immediately. Duration cannot fall below zero; reaching zero ends the suspension and it cannot be revived by mere duration extension. Expired records are historical information, not active targets.

A suspended collected trigger remains pending with original queue/ordering information and does not block unrelated eligible triggers. If its Menu reaches it, skip it; it cannot re-enter that same resolving Menu even if suspension ends before the Menu finishes. Afterward use its retained queue precedence. Successfully negating a collected trigger permanently removes it; suspension ending cannot restore it. Historical records remain for explicit references.

Simultaneous duration expirations/termination events update combined game state first, then collect eligible event-specific triggers. Expiration and negation/removal are distinct causes. If protection expires exactly as final suspension ends, it expires without briefly resuming. Full exact historical rulings remain in the Existing Rules Registry.

## 11. Search wording
Search the Main Deck as it exists at resolution, retrieve as many eligible cards as possible up to the printed maximum, follow reveal instructions before remaining steps, and follow required shuffling even if no eligible cards are found. The searching player orders cards added to hand unless text says otherwise. No general permission exists to inspect/search the deck.

## 12. Foundational completions — designer decisions D001–D020

These decisions fill missing essentials. They preserve the established game identity and are recorded separately from historical approvals.

**D001 — Registration and setup.** Register 40–60 Main Deck cards and exactly20 separate-deck slots. Each Equipment copy occupies1 slot; each transformed Character copy occupies2. Count actual copies, not slots, toward the maximum3 per ID across registration. Base Characters, Abilities, Speed Abilities and Finishers go in Main; Equipment and transformed Characters in Equipment/Transformation. At most6 Finisher copies total. No sideboard in this edition. Players reveal decks' counts and separate-deck contents. Randomly determine who chooses the first player. Each selects and reveals one nontransformed Character from their registered Main Deck as starting Main; remove it to Center before shuffling and drawing5. It counts toward Main Deck registration, not as an extra free registered copy. Both start15 life,5 Momentum,0 Light and0 Darkness. Characters start fullHP including Center bonus. No starting Party Members.

**D002 — Mulligan.** Each player once sets aside0–5 chosen opening hand cards face-down, shuffles those cards back into their Main Deck, then draws that many. Resolve first player's mulligan then second player's. This may redraw returned cards. No further mulligan. No game actions or triggers during setup unless explicit setup text.

**D003 — Turn sequence.** Beginning: reset 'each turn' counters for both players, gain5 Momentum and1 Light/1 Darkness simultaneously, then draw1. Process resulting trigger groups chronologically; simultaneous gains precede draw. Main Phase follows, then Battle Phase, then End Phase; no second Main Phase. A phase advances when both pass on an empty Menu with no eligible pending triggers. At End, process end-of-turn triggers before expiring 'this turn' effects simultaneously, then process expiration triggers. First player draws normally but cannot declare attacks during their first turn. Neither player can initiate ordinary attacks outside their own Battle Phase. Resources persist without caps or expiration. Reason: banked resources were established; limiting only first-turn aggression provides initial defense opportunity.

**D004 — Arsenal access.** Equipment/Transformation Deck is a public, freely selectable arsenal, not shuffled or drawn from. Reveal the chosen card on activation. Pay costs and declare host/base. Attachment/transformation uses a Menu and may be answered. A pending arsenal card is set aside publicly until its Select resolves or is negated. An opponent cannot target a different unused arsenal card unless text explicitly permits. Reason: follows the established re-equipping destination and intentional build-access model without adding a new draw system.

**D005 — Basic action windows.** Add to Party, free Center switch, Party Swap, standard attach, transform and voluntary unequip are own Main Phase empty-Menu actions. Every one opens a Menu; Main switch/Swap/Add have rule-defined Selects, which can be responded to but cannot be negated by text limited to Ability cards. Declare exact Character/Equipment instances and all targets before passing priority. Pay activation costs upfront. Add requires a Character in hand and empty Party Zone, consumes the one standard Add allowance on legal activation even if prevented; effect-based Adds do not consume it. Normal Characters have no inherent cost. An unsuccessful free Center switch consumes that free switch. Unequip returns the chosen gear at resolution, free, with no refund; effect removal can answer it. No voluntary standard Character withdrawal.

**D006 — HP changes.** Entering Center increases both maximum and currentHP by13000; leaving decreases both by13000, currentHP minimum1. Equipment or passive maximumHP increases do not heal currentHP unless explicitly printed. Losing maximumHP clamps currentHP to new maximum without treating the clamp as damage or defeat. Printed ATK and maxHP cannot fall below0 and1 respectively. 'Heal' and 'restore HP' mean the same instruction. FullHP means current equals actual maximum at the time checked.

**D007 — Combat declaration.** Initiate a sequence using either unused free Main attack or unused free Party attack. The initiator must occupy the relevant zone. All extra distinct eligible attackers cost2 Momentum each; an added Main participant also pays2 and does not consume a free allowance merely by joining. Any successful attack consumes that Character's own turn attack use; initiating successfully consumes its shared free allowance. Paid failed attacks get no refund; unsuccessful resolution consumes neither Character attack usage nor shared free attack allowance. After attacker declaration and payment, defender declares and pays all Allied Guards once; then attacker/opponent alternate legal Selects, beginning with attacker. Allied Guard declarations are rule actions in that declaration window, not cards or Selects that negate abilities. Neither attackers nor guards can be added after this window except explicit text.

**D008 — Combat resolution.** Resolve combat Menu and all resulting eligible trigger Menus before calculating damage. An attacker/guard that leaves loses participation; one returning is a new instance. If original target leaves or becomes illegal before damage, the entire combined sequence fails; no retarget, damage, or attack-use consumption. If at least one eligible attacker remains and target is legal, resolve combat, even if damage becomes0: contributing attackers consume uses and initiator's free allowance is consumed. Each surviving eligible guard is counted once. Combined damage uses current modified ATK, then explicit global reductions, then divides: each receives floor(total/n), and original target receives the entire remainder total mod n in addition. Apply explicit redirection once, then individual prevention/reduction. Resolve simultaneous HP loss and defeats before after-combat events. No responses during calculation or defeat finalization. Separate effect damage generated by responses resolves in its Menu and is not added to combat unless explicitly printed as Chain damage.

**D009 — Defeat origin.** Only damage from a Battle Phase attack's final combat calculation causes the established player life loss and defeat Momentum. Separate effect damage can defeat Characters but causes neither player life loss nor defeat Momentum, even when activated in a combat Menu. This follows the user's 'only battle phase attack' direction and avoids removal bypassing the HP combat economy. Explicit future life-changing card text would need individual review; launch set uses none. Effect-defeated Main revives as normal without life/Momentum consequences.

**D010 — Main revival.** An untransformed defeated Main revives in Center at fullHP as a new instance. Gear returns to arsenal; temporary effects, instance-specific references and damage clear. Per-card-name and physical-copy usage limits remain consumed for the turn. Revival does not restore shared attack/switch/Add allowances. Two simultaneous losing conditions produce a draw; evaluate life losses simultaneously before processing triggers. Required empty-deck draw loses immediately; if an explicit simultaneous draw instruction makes both unable to draw, draw the game.

**D011 — Transformation base supply.** On successful transformation, place the actual base card face-up beneath the form as its public base record, outside Character Zones; it has no active abilities or Equipment. The form is a new Character state of that same zone, with attack use inherited. The historical requirement of 'another existing exact base copy' for transformed Main restoration is met by reserving a second registered exact base copy: before Main transformation, reveal one from hand/Main/Continue? and place it in a public Base Reserve. It remains owned and unavailable for any other purpose while reserved; shuffle Main if searched. If no second registered copy exists, that Main transformation is illegal. A Party transformation needs no reserve. When transformed Main is defeated, put form and original underlay base into Continue?, restore the reserved other copy fullHP in Center, consume reserve. On Party form defeat both form and underlay go Continue?. Owner-controlled explicit reversion returns form to arsenal and restores original underlay to zone, releasing reserved copy to its original zone (shuffle if Main). No free standard reversion. This preserves exact-base and existing-copy requirements and removes ambiguity over cards in hand/deck. The base underlay never duplicates into an extra registered card.

**D012 — Finisher timing.** Every launch-set Finisher costs4 Momentum upfront, has a printed combat response condition and consumes its card-name turn limit. It is neither an Ability nor a Speed Ability for effects naming those types and grants no Speed Momentum. All launch Finishers additionally print a shared restriction: activate at most one Finisher per player per combat. This is a first-set printed safeguard, not a historical universal limit or replacement for six-copy deckbuilding. It prevents banked Momentum from deciding an entire combat through multiple ultimates while allowing later combats their own cinematic moments. Negation still consumes its use and4 Momentum.

**D013 — Targets and choices.** 'Choose' a specific Character, Equipment, card, or pending Select is targeting unless explicitly stated otherwise. Declare those targets on activation/collection; future-event targets ('after combat choose a surviving attacker') are declared when the delayed trigger is collected. Nontargeted 'all/each' does not choose individual targets. Conditions 'when ...' remain available through that event's open Menu; not after it and never during resolution. At activation there must be a possible legal mandatory target/result; fullHP healing is legal and may waste healing. Recheck target identity, location, control and printed essential conditions at resolution. Once established, durations remain even if the original activation condition stops being true, unless stated otherwise.

**D014 — Restriction and counters.** Card-name once-per-turn limits are shared across all copies controlled by the same player and persist through zone/control changes; both players have independent named counters. 'Once per turn' on Equipment is per physical card and individual ability, persists on that card through removal/reattachment/control. Non-Equipment text explicitly uses card-name limits. Both reset at each turn beginning. Multiple independent continuous numerical bonuses stack; independent maximum caps/restrictions all apply and use the most restrictive compatible result. A cannot instruction prevents the prohibited action unless text explicitly overrides it. This does not retroactively detach gear on subtype loss.

**D015 — Optional triggers and suspension.** Optional trigger controller may decline collection, or decline an optional 'you may pay' on resolution. Mandatory essential costs are not optional. New suspended-trigger records retain original group/event/order identity; after current Menu finishes, resume eligible retained records ahead of later event groups, never re-enter their original Menu. This completes queue scheduling without inventing new suspension mechanics. For rare historical interactions see exact H-series registry.

**D016 — Information and locations.** Continue?, battlefield, arsenal, Base Reserve, base underlays, resource totals and declared pending cards are public. Main Deck and hands hidden, counts public. Maintain zone-card order only if an effect cares; no top-of-Continue? rule. Moving to a new zone produces a new instance except explicitly retained physical usage/base information. Reveal searched cards to verify eligibility, then shuffle when instructed. 'Top N' uses min(N, remaining count), then follow printed remainder instructions. Owner is registered owner and never changes. Controller determines decisions and effects unless explicitly specified; attached Equipment normally follows host control with compatibility checked when explicitly transferred.

**D017 — Repeated mandatory loops.** The launch set avoids unbounded engines. If an exact full game state repeats in a mandatory sequence with no legal choice to change it, game is a draw. Optional loops must state a finite legal repetition count and then stop; no infinite resource declarations. Random/hidden outcomes cannot be assumed to repeat. Record any such discovery as a card revision issue.

**D018 — Common vocabulary.** 'Allied/your' means controlled by you; 'opposing' by opponent; 'another' excludes source. 'Bearer/host' is attached Character. 'Equipped' means at least one attached Equipment even if negated. 'Printed' ignores modifiers. 'Damaged/wounded' means currentHP below actual maximum; 'below half' is strict currentHP < maxHP/2. Separate damage is effect damage. Redirection changes damage assignment, not original attack target. A combat is one declared attack/Chain sequence. No elemental weakness, tapping, summoning sickness, terrain or automatic ATK counterdamage exists unless explicitly printed.

**D019 — Affiliation and subtype architecture.** Combat disciplines, franchise mechanical tags, species/nature, affiliations and form categories are separately classified in registries. A Character may carry several; 'has subtype X' queries the union of combat/franchise/species subtype fields, not affiliations or a textual role. Transformations explicitly include Transformed. No subtype automatically grants an unprinted rule.

**D020 — Release status.** Version1.0.0 is a design freeze for integration and evaluation. Designed, structurally validated, mechanically reviewed, balance-reviewed, scenario-tested and full-game-playtested are distinct. No structural pass establishes competitive balance. Changes require a changelog entry, revalidation of impacted cards/decks, and updated reports. Official-art coverage is measured by actual matched local assets, not by a franchise link.

## Final integration clarifications to D013–D015

- Activated Equipment abilities identify their bearer at activation. Later detachment does not cancel that already-activated effect unless printed wording explicitly requires continued attachment/presence. The same Character instance must remain legal. Passive bonuses cease immediately when gear leaves. Consuming its own Equipment does not cancel later instructions in that ability.
- Activation-event triggers created while a Menu is open wait until that Menu finishes, in event-order groups. They do not insert into the open Menu. Each resulting new Menu accepts responses. Drain pending combat trigger Menus before damage calculation.
- Interlink CS1-341 establishes a temporary linked Fusion State for three canonical pairs. It is not an additional Character type and grants no Transformed immunity. Printed partner restrictions and end-of-state HP subtraction govern it.
- Affected launch cards explicitly prevent self-inflicted effect damage from defeating an untransformed Main. This closes deliberate free full-HP revival without changing ordinary effect-defeat or transformed-state rules.
- Sora CS1-001 is a series-spanning base identity; forms require this exact registered card ID, not any future card also named Sora. Specific card-version requirements remain in force.

## Revision lineage
- Earlier three Momentum/turn becomes latest five; old cap fourteen becomes no maximum.
- Earlier separate per-attacker Chain damage and block assignments become latest combined damage, automatic even Allied Guard division, individual reduction afterward.
- Earlier Main removal exception becomes later absolute effect-removal protection, except owner's explicit Transformation procedure.
- Earlier two normal party calls becomes latest one because Main is chosen before game.
- Earlier transformed form-to-form flexibility becomes later exact-base-only eligibility.
- Latest directive confirms subtype AND/OR, persistent attachment after subtype loss, and five primary types.

