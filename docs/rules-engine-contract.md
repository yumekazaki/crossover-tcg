# Rules engine contract
Version 1.0 audit • 2026-10-30 • documentation only

## Authority and scope

This contract maps the copied design rules to implementation requirements. It does not amend them, certify card balance, or claim that an engine already supports them.

Read together:
- [Master rulebook](../data/source/master-rulebook.md), version1.0.1: current playable authority, including D001–D020 and final integration clarifications.
- [Decision ledger](../data/source/decision-ledger.md): identifies designer completions and historical conflict corrections.
- [Existing Rules Registry](../data/source/existing-rules-registry.md): exact historical user statements and turn IDs; includes superseded decisions and contextual discussion, not a second set of cumulative active rules.
- [Keyword reference](../data/source/keyword-reference.md): standardized aliases; the master rulebook prevails.

**MUST** below denotes a requirement already supported by those sources. **Model recommendation** denotes an implementation representation, not another game rule. Unresolved points at the end MUST remain visible until resolved; do not silently fill them with conventions from another TCG.

Latest five-Momentum gain, uncapped resources, one standard Party Add, combined Chain damage and post-split individual reduction supersede earlier historical alternatives. D001's20 weighted slots, open arsenal and second-copy reserve are explicit designer completions; do not mislabel them as historical user approvals.

## State and identity model

Model recommendation: use a deterministic command reducer with an append-only event journal. Record a rules version and card-data revision in each match. A command returns either a validated next state plus events, a pending choice, or a structured rejection. Rejected commands MUST NOT partially spend resources, consume allowances or move cards.

Distinguish at least these identities:

| Identity | Purpose |
|---|---|
| Card definition ID | Exact registered version; transformations use exact base ID, not name matching. |
| Physical copy ID | One registered card, immutable owner/original deck; Equipment usage survives removal and control changes. |
| Battlefield instance ID | A current deployment; leaving and returning creates a new instance and invalidates old references. |
| Effect / Menu Select ID | Activated effect survives source departure unless a printed essential condition requires presence. |
| Event/group/combat ID | Preserves simultaneous events, event chronology, damage origin and per-combat restrictions. |
| Card-name usage key | Per-player shared name restriction; distinct from physical-copy Equipment usage. |

Required match state:
- Setup stage, active player, turn number, first-turn attack prohibition, phase and phase checkpoint.
- Priority player, consecutive passes, current Menu state (absent/open/closed/resolving), resolution cursor and outstanding resolver choice.
- Per player:15 starting life; Momentum/Light/Darkness; ordered hidden Main Deck; hidden hand; public Continue?, arsenal, Center, six Party Zones, Base Reserve and base underlays.
- Registration and immutable owner/original-deck data, separate from current zone/controller.
- Current HP; derived printed/modified ATK and maximumHP; subtypes classified by combat/franchise/species; affiliations separately.
- Attachment graph, transformation lineage/base reserve linkage, temporary Fusion State links, modifiers/protections/suspensions and explicit duration anchors.
- Used standard Add, free switch, free Main/free Party attack allowances; Character successful-attack use; player/name turn counters; physical Equipment/ability turn counters; per-player current-combat Finisher use.
- Collected trigger groups, delayed effects, skipped suspended records, immutable event snapshots and relevant last-known information.
- Terminal result/reason and deterministic random/shuffle state sufficient for replay.

No extra persistent Persona zone, token system, tapping/exhaustion, elemental weakness, automatic retaliation or positional Party-lane advantage exists. Persona Manifestation is an Ability subtype; Interlink Fusion State is a printed temporary linked state, not Transformed immunity.

Public views MUST expose public zones, counts and resources without exposing opposing hand/deck identities. Inspection/search/reveal permissions come only from actual rules/effects. A local testing interface may expose full state, but MUST label that as a testing view rather than normal player information.

## Setup and turn state machine

D001–D003 require:
1. Validate40–60 registered Main cards, exactly20 arsenal slots, Equipment1slot/form2slots, at most3 copies per exact ID across registration and at most6 total Finisher copies. Validate type/deck placement; no sideboard.
2. Randomly determine who chooses the first player. Each player selects/reveals a nontransformed Main-deck Character, moves that physical copy into Center, then shuffles remaining Main and draws5. It remains part of registered Main count.
3. Both start15life,5Momentum,0Light/0Darkness, no Party Members; Center Character starts fullHP including13000 bonus.
4. Once per player, first player then second, shuffle0–5 selected opening cards back before drawing replacements. No setup actions/triggers absent explicit setup wording.
5. Beginning of each turn: reset each-turn counters for both players; gain5Momentum and1Light/1Darkness simultaneously for active player; then draw1. Collect/process gain-event groups before draw-event groups. Resources persist with no cap. First player draws normally but cannot attack during first turn.
6. Main → Battle → End, without second Main. Both players must pass on an empty Menu with no eligible pending triggers to advance. End triggers resolve before simultaneous expiration of this-turn effects, followed by expiration triggers.
7. No ordinary attacks outside active player's Battle Phase. No generic voluntary draw and no maximum hand size.

Reset turn-scoped restrictions at every turn beginning, not only their controller's own turn. Preserve effects whose expiry is anchored to a particular player's next turn rather than a generic turn count. Exact boundary ordering for additional duration anchors is listed as an unresolved detail below.

## Commands and legality

Model recommendation: commands carry actor, match revision, command ID, physical/instance references and declared choices; reject stale revisions and duplicate command replay without charging twice. This is transport safety, not game timing.

| Command family | Required window and checks |
|---|---|
| ChooseFirstPlayer / ChooseStartingMain / Mulligan | Correct setup stage and actor; no ordinary priority actions. |
| AddToParty | Own Main, empty Menu, hand Character, empty Party Zone, unused standard Add. Forms cannot use normal Add. |
| SwitchMain | Own Main, empty Menu, unused free switch; existing Center and Party instances both untransformed. |
| PartySwap | Own Main, empty Menu,6Momentum; up to2 untransformed allied Party Members; repeat if paid. |
| AttachEquipment | Own Main, empty Menu, public available arsenal copy, legal host, full printed costs and AND/OR compatibility. |
| Unequip | Own Main, empty Menu, controlled attached Equipment; no cost/refund; destination owner's arsenal on resolution. |
| Transform | Own Main, empty Menu, available exact form, exact legal base, all printed conditions/costs; Main also needs second registered exact base copy. |
| ActivateAbility | Own Main, empty Menu, eligible hand card and printed restrictions. |
| ActivateSpeed | Either player's valid priority/action or response window, eligible hand card and event/condition. |
| ActivateFinisher | Printed combat response window,4Momentum, name restriction and that player's unused Finisher allowance in this combat. |
| ActivateSpecial / EquipmentAbility | Correct source zone/controller, printed timing, targets, costs and usage. Passive Specials are not commands/Menu Selects. |
| DeclareAttack | Own Battle, first-turn attack restriction clear, correct unused free initiator allowance, distinct eligible participants and valid opposing target; pay2Momentum per additional attacker. |
| DeclareAlliedGuards | Defender's single declaration checkpoint; original target automatic, only distinct eligible Party assistants,2Momentum each. |
| PassPriority | Actor currently has priority in an open action/response window; never a substitute for a mandatory resolver choice. |
| ChooseTriggerOrder / ChooseOptionalTrigger | Collection scheduling only, according to event/controller rules. |
| SubmitResolutionChoice | Only the player responsible for an explicitly requested resolution decision; cannot open responses. |

Basic actions D005 create rule-defined Menu Selects. They can receive responses, but text negating an Ability card cannot negate a rule-defined Add/switch/Swap action. Effect Adds are executed by their resolving instruction and do not consume standard Add allowance.

A legally activated standard Add consumes its allowance even if prevented; an unsuccessful free switch consumes its allowance. In contrast, failed attacks consume neither attack use nor free attack allowance. Do not conflate those counters.

Mandatory activation costs MUST be affordable immediately. Pay all activation costs upfront, mark applicable use, and create the pending Select atomically. Future unresolved resources cannot pay them. Costs/usage remain consumed after negation/failure. Printed discard, HP reduction, Equipment return and resource payments must retain their actual instruction type; an HP payment is not automatically damage.

Every legal Speed activation grants1Momentum. Its timing relative to activation-negation is a specifically flagged detail below; it MUST NOT make an unaffordable activation retroactively legal. Finishers grant no automatic Speed Momentum and are neither Ability nor Speed Ability for type-specific effects.

Declare all specific targets on activation/collection unless printed wording explicitly creates a later or nontargeted choice. “Choose” normally means target; “all/each” does not. FullHP healing is legal even if all healing is wasted. There must be a possible legal mandatory activation result; mandatory triggered collection has its historical exceptions for missing targets/payments.

## Menu and trigger scheduler

Open Menu:
- Responses alternate; a player may respond to their own Select when priority returns.
- Adding a legal Select breaks consecutive passes. A pass is not a permanent surrender of response eligibility.
- After two consecutive passes, close immediately, then resolve all entries newest-first. No new Selects, responses or interruptions during any part of resolution.
- Pausing for an explicit choice/payment while resolving is permitted; that pause is not a response window.

Resolution:
- Activation conditions are not rechecked unless printed ongoing/essential requirements require it.
- Recheck target instance, location, control and legality. Ignore illegal targets, retain independent legal instructions, and do not automatically retarget. No legal targets means no target-dependent effect, not a refund.
- Activation Negation and Effect Negation are distinct outcomes. Ability/Speed cards end in their owner's Continue? even when activation/effect-negated or without legal targets, absent explicit exception.
- A legally activated Character/Equipment effect is controlled by its activating player despite source-control changes. Remember source/bearer instance at activation. Source departure alone does not cancel it; explicit continued-presence/attachment requirements do.
- Separate decisions needed at resolution belong to current effect controller unless text says otherwise. Mandatory essential costs unpaid cause dependent instructions to fail with no partial payment; legal independent portions continue. Optional payments may be declined.

Collection and queuing:
- Record events and last-known snapshots when they occur, not when their triggers eventually resolve.
- Mandatory triggers collect even without present resources/targets. Optional collection decisions are final; a declined trigger cannot return later.
- Simultaneous event triggers form one group. Turn player places own triggers first, then opponent; each chooses insertion order of own triggers. Backward resolution reverses that placement order.
- Distinct events create FIFO groups. New events arising during an open or resolving Menu wait until that Menu fully finishes; never insert into it. New groups append behind previously recorded events.
- Each trigger-group Menu accepts normal responses. Process eligible pending groups before returning ordinary priority. In combat, drain combat response Menu and all resulting eligible trigger Menus before damage.
- Suspended records retain event/controller/order identity and do not block eligible unrelated records. A skipped record cannot re-enter its original Menu. Once eligible after that Menu ends, retained earlier records precede later groups per D015. A successfully negated trigger is permanently removed, not merely paused.

Model recommendation: separate immutable trigger records from current Menu presentation; do not destroy a skipped suspended entry when popping a Menu. Store collection time, original group/insertion position, current controller and a “skipped in Menu” marker.

## Combat transaction

D007–D009 require one combined sequence, not a list of interruptible attacks:
1. Declare initiator using unused free Main or free Party allowance. Declare all extra distinct attackers and one original opposing Character instance. Pay2Momentum for every extra, including an additional Main.
2. Defender declares/pays all guards once. Original target is free/included. Main cannot be an additional Party guard. An attacker can also guard later that turn; no generic defend-use limit.
3. Begin responses with attacker, alternate normally, resolve Menu and eligible trigger groups completely.
4. Remove ineligible participants. A returning physical card is a different instance. If original target left/became illegal, fail entire sequence: no damage, retarget or attack-use consumption; paid costs stay spent. If no eligible attacker remains, sequence cannot deal its declared attack.
5. If at least one attacker and original target remain legal, resolve even at zero damage. Participating eligible attackers consume their successful-attack use; initiator's free allowance is consumed.
6. Compute modified ATK contributions plus explicit combined damage; apply explicit global reductions, never below0. Let total=T and eligible defenders=n. Each receives floor(T/n); original target additionally receives T mod n in full.
7. Apply explicitly established redirection once, preserving original target identity. Invalid receiving Character means failed redirection and original assignment remains. Then each recipient's own reduction/prevention; unused reduction is wasted. Protected original target stays in distribution.
8. Commit all recipients' HP damage simultaneously, then all defeats simultaneously. No overflow transfer, automatic counterdamage, actions or response windows during calculation/defeat.
9. Apply life/Momentum consequences, required Main restoration, trigger scheduling and after-combat events in their prescribed order.

Example:10001 damage/3defenders yields3335 to original target,3333 to each guard before individual defenses. A guard assigned3333 with2000HP can be defeated, but1333 excess never transfers.

Separate effect damage generated by responses resolves in its own Menu and does not join combined combat unless explicitly stated. Only final Battle attack combat defeats cost player life/grant defeat Momentum:1/1 per Party,2/2 per Main. Effect damage may defeat/revive Main without those consequences. Direct sends/returns are not defeat damage. Preserve damage origin explicitly in events; location inside a combat Menu alone does not make damage combat damage.

## HP, movement, and Equipment

MaximumHP=printed+active modifiers, clamped at least1; ATK at least0. Enter Center adds13000 maximum/currentHP. Leave subtracts13000 from both, currentHP minimum1. Other maximumHP increases do not heal unless text says so; maximum decreases clamp currentHP without damage/defeat. Healing caps at actual maximum and cannot revive.

Every zone transition MUST:
- Preserve physical owner/original registration and necessary usage records.
- Create a new instance where required; expire/retain only effects according to text.
- Return all attached gear to each original owner's arsenal on Character departure.
- Capture last-known Character stats/attachments/modifiers before destruction/movement for eligible triggers.
- Apply legal destination/protection checks, avoiding duplicate copies or silent card creation.

Main is protected from ordinary nondamage effect removal; its owner's specific transformation procedure is the established exception. Transformed Characters have nondamage removal protection; only owner-controlled explicit reversion can end their form. Damage remains legal. Ordinary self-controlled Character bounce/shuffle/send requires fullHP at the actual relevant instruction/cost; Party Swap/Transformation/explicit printed exceptions override it. Ordinary revival returns to an available Party Zone, not Center.

Equipment:
- Unlimited compatible gear/duplicates; no weapon slots. Subtype query uses combat/franchise/species union; affiliations do not satisfy it unless explicitly queried.
- AND means all; each OR group requires an eligible alternative. Check when attaching/moving to a new host. Subsequent subtype loss never detaches/deactivates already legal gear.
- Transformation is the explicit gear-transfer compatibility exception.
- Passive bonuses end when source detaches/is negated. Activated effects remember original bearer instance, and consuming own gear as cost does not cancel later instructions.
- Each physical Equipment ability is once/turn by default unless printed otherwise. Copy/ability counters survive transfer, detachment, reattachment and negation.
- Party Swap alone refunds half each printed Light/Darkness component:0→0,1→1,2→1,3→1,4→2. No spent-cost or current-discount substitution. Other removal/unequip/failed attachment refunds nothing.
- Negated attachment returns pending Equipment to owner's arsenal. Negating attached effects leaves it attached.

## Transform, revert, defeat, and reserve

Transform requires exact base definition/version, not merely name; no form-to-form transformation. Pay printed costs and printed setup conditions. Form stays in same Character Zone; cannot use standard switch or Party Swap.

On successful transform:
- Put original physical base face-up beneath form, inactive and outside Character Zones.
- Enter form fullHP; remove temporary buffs/debuffs except explicit carryover, retain attack use/free allowances; transfer compatible gear and return incompatible gear without refund.
- For Main, a second existing exact registered base copy must be revealed/reserved from hand/Main/Continue? before transformation; Main search shuffles. Reserved copy is public/unavailable for other purposes. No second copy means illegal Main transform.
- Party transformation needs no second-copy reserve.

Transformed Party defeat sends form+underlay to Continue?. Transformed Main defeat sends both there and restores reserved second exact copy in Center at fullHP. Consume reserve; do not create a card. Normal untransformed Main revival is a new fullHP battlefield instance; gear and temporary effects clear while name/physical use and shared allowances remain consumed.

Explicit owner-controlled reversion returns form to arsenal and restores underlay in zone, releasing second reserved copy to its recorded original zone, shuffling if Main. Exact HP/current-effect handling of voluntary printed reversion requires clarification below.

Self-inflicted damage restrictions on affected launch cards are card-specific. Do not turn their text into an unstated global rule that all effect damage can never defeat an untransformed Main.

## Effect control, protection, and suspension

Owner never changes. Character/Equipment current controller and activated-effect controller are distinct. Control of an established delayed effect, protection, suspension or collected trigger changes only through explicitly eligible effects; source control changes do not implicitly transfer pending effects. Latest successful explicit transfer determines future choices, costs and benefits. Retain original activating/triggering player and complete relevant control history.

Protection/suspension layers retain independent controller, scope, conditions, duration and association. Check actual protection when a transfer/removal/negation resolves. Negating a transfer preserves previous controller; paid costs/uses stay consumed. No layer has automatic immunity.

Suspension suppresses scoped protection but does not pause its underlying duration. Resume only with remaining duration and no other applicable suspension. Terminations/expirations simultaneous at one checkpoint update combined state before collecting triggers. If protection expires as final suspension ends, it expires without a brief active interval. Duration zero terminates; later extension cannot revive a terminated effect absent explicit reestablishment. Historical records are not active targets, unless explicit text allows such interaction.

## Win conditions, replay, and acceptance

A player at0life loses; simultaneous losing conditions draw. Required draw from empty Main loses immediately, and explicitly simultaneous failure for both draws. Life/Momentum consequences from simultaneous combat defeat are evaluated together before resulting triggers. Stop accepting gameplay commands after terminal result.

Mandatory exact-state loop with no legal divergent choice draws; optional loops require a finite count and stop. Do not equate an unresolved loop with proof of infinite resources, or assume hidden/random outcomes repeat.

Model recommendation: build acceptance cases for:
- Setup copy accounting, first-player draw/no-attack, mulligan return-before-draw.
- Cost failure atomicity and paid-cost negation; no resource anticipation.
- Double pass closes Menu, reverse resolution, no resolver interruption, queued trigger groups.
- Simultaneous ordering, source departure, missing target/cost, suspended skipped trigger resumption.
- Correct10001/3split, per-recipient reduction, redirection once, no overflow, effect-vs-combat defeat.
- Zero-damage successful attack consumes use; illegal-target failed sequence does not.
- Switching13000 adjustment; gear HP clamp without defeat; healing cannot revive.
- Equipment duplicate stacking, subtype loss persistence, physical usage persistence and Party Swap refund vector.
- Exact-base reserve, unsuccessful/negated transformation cleanup, Party-vs-Main form defeat.
- Two simultaneous life losses, empty draw, and explicit supported loop handling.

A resolver that supports only ordinary attack/guard and manual HP adjustments MUST be labeled partial. A searchable card database or plausible UI does not establish500-card effect support. Record supported command/effect capabilities separately from structural validation, semantic review, balance review and actual gameplay tests.

## Unresolved implementation details — do not silently invent rulings

| ID | Open detail | Required handling |
|---|---|---|
| U001 | Exact moment of automatic Speed+1 relative to a legally attempted but activation-negated Speed. “Every legal activation” and “does not successfully activate” are not explicitly reconciled. | Costs must be affordable before gain. Preserve a test/decision for whether legal commit grants immediately and survives later negation. Do not count pending gain toward cost. |
| U002 | Main Base Reserve is selected before transformation, but negated/failed transformation cleanup and timing of reservation are not explicitly specified. | Keep origin metadata; obtain a ruling for when reserve becomes unavailable and where it returns on failure. Never strand/duplicate it. |
| U003 | Owner-controlled printed reversion restores underlay, but HP restoration, temporary-effect inheritance and attack-use inheritance on that route are not comprehensively stated. | Implement only explicit card wording plus confirmed general limits; flag unspecified reversion HP instead of assuming transform full-heal. |
| U004 | Within one recipient, flat reduction, percentage reduction, prevention, “leave at1” and replacement effects can interact; no general mathematical layer-order rule is stated beyond global→split→redirection→individual. | Preserve source/controller/order and require an explicit scoped ordering decision for noncommuting combinations. Do not import another TCG's layers. |
| U005 | Exact expiry checkpoint for “until your next turn begins”, next-attack/next-damage shields and temporary Fusion State relative to start gains/draw/triggers is not fully ordered in D003. | Use explicit anchors, expose ambiguity, add timing tests before supporting affected interactions. |
| U006 | Mandatory triggers collect without targets, while D013 declares targets at collection. A nonexistent target cannot later be automatically selected without permission. | Represent a collected record with no bound target and preserve no-auto-retarget rule; clarify any card requiring later target selection. Activation-result legality does not suppress mandatory collection. |
| U007 | Character control transfer between battlefield zones, Center/Main identity, capacity and application of removal protection have no complete universal placement procedure. | Do not implement silent stealing/repositioning defaults. Explicit Equipment/effect-control transfers are already specified and can be supported independently. |
| U008 | Multiple competing redirects/preventions established before damage need a tie/choice procedure when their effects do not commute. | Retain Menu order and printed timing; seek the smallest ruling where these do not determine the result. |
| U009 | D017 “exact full game state” equivalence needs a practical definition excluding irrelevant journal IDs while retaining relevant historical references. | Do not claim automated loop detection until that definition and demonstrable cases exist. |
| U010 | Partial resolution of multi-object rule actions (especially one of two Party Swap targets becoming illegal, or both switch targets failing) is not individually described beyond general legal-portions rules. | Apply explicitly independent portions where clear; report cases requiring an atomicity ruling rather than refunding costs or automatically selecting replacements. |

These are implementation-specific gaps, not permission to reopen deck size, resource gains, Main protection, Menu behavior or other locked foundations.

