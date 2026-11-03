# Effect coverage implementation plan

Audit of the canonical `data/cards.json` (500 records) against the current executable programs in `src/engine/effects.js` on 2026-10-30. This is an implementation map, not a rewrite of card text or a claim of mechanical validation. The existing implementation has two effect programs (`CS1-281`, `CS1-433`); 498 records are not executable yet. Keyword counts below overlap because one card can use several mechanisms.

The source data and recent card revisions are explicitly not balance-reviewed or playtested. Preserve each card's exact printed conditions, timing, costs, targets, once-per-name restrictions, and post-resolution clauses. The player preference in the project history favors combo lines, response interaction, deck/hand movement, and Light/Darkness/Momentum generation over standalone numerical stat boosts; use that as a selection priority, not permission to alter card text.

## Reusable resolver families

| Family | Source-text patterns present in the set | Indicative examples | Required engine support before mapping |
|---|---|---|---|
| **Effect lifecycle and identity** | Once-per-name use; cost payment; targets; source leaves; per-instance delayed clause | Sora `CS1-001`; Riku `CS1-002`; Kairi `CS1-003` | Physical card and battlefield-instance identities; atomic costs; shared name counters; delayed effects tied to the correct instance and controller; exact trigger checkpoint. Base reducer groundwork exists, but only simple activated/response paths are implemented. |
| **Menu response and scoped negation** | Open-Menu response; negate an effect only on one target; let remaining instructions resolve; effect/Equipment suppression; conditional taxes | `CS1-323` Arsène; Speed Abilities `CS1-392`, `CS1-395`, `CS1-400`, `CS1-410`, `CS1-418`, `CS1-425`, `CS1-428`, `CS1-438`, `CS1-440`, `CS1-447`, `CS1-456` | Pending instruction records with target scope and source; before-resolution timing; preserve unaffected instructions; no response once resolution begins; retain paid costs and activation use after negation. The current two-pass Menu is a base, but targeted partial negation is not implemented. |
| **Reveal, search, reorder, and place** | Inspect top N; reveal; find by type/subtype/form; add to hand/Party/Continue?; top/bottom ordering; shuffle when required | `CS1-004` Roxas; `CS1-014` Namine; `CS1-024` Skuld; `CS1-285` Stocked Memories; `CS1-287` Command Meld; `CS1-290` Union Cross; `CS1-320` Dorm Study Session; `CS1-339` Blade Awakening; `CS1-387` Evidence File | Ordered library zones; hidden-information choice model; exact physical-copy movement; destination legality and occupied Party Zone choice; deck exhaustion semantics; explicit shuffle instructions only. UI choice schema needed. This family directly enables user's requested “places from the deck.” |
| **Hand costs and filtering** | Discard/send as activation cost; reveal a held card; draw then discard/bottom; retrieval from Continue? | `CS1-005` Axel; `CS1-198` Grand Chef; `CS1-298` Cooking with Friends; `CS1-312` Cross-Chain; `CS1-319` Theurgy Charge; `CS1-323` Arsène | Cost validation before Menu open; exact card instance payment; atomic rejection; draw/empty-deck loss; hand secrecy and choice; discard versus bottom versus Continue? as distinct zones. Enables the requested hand-based lines without turning discard into a generic cost. |
| **Light, Darkness, Momentum economy** | Immediate conditional gains, conversion, chain-cost discounts/taxes, delayed refunds, activation Speed gain | `CS1-001` Sora; `CS1-186` Way to the Dawn; `CS1-289` Attraction Opening; `CS1-311` Armiger Preparation; `CS1-316` Aether Channel; `CS1-318` Shift; `CS1-319` Theurgy Charge; `CS1-344` Chain Order | Typed resource vector and exact printed cost/rebate semantics; costs cannot use gains that resolve later; reductions cannot cross each card's stated floor; effects may not refund costs already paid; speed activation gain timing requires unresolved U001 ruling. |
| **Damage, healing, prevention, and damage transfer** | Targeted effect damage, simultaneous multi-target damage, healing, damage prevention, transfer, post-combat effects | `CS1-005` Axel; `CS1-012` Donald; `CS1-026` Meow Wow; `CS1-333` Break Setup; Speed Ability `CS1-401` Arrival of Light; Finisher `CS1-468` Supernova | Separate effect damage from combat damage; simultaneous damage/defeat batches; no overflow; heal caps and no revival; damage-origin attribution; apply global split then redirection then individual defenses. Combat implementation supports only a subset; general effect-damage batch is missing. |
| **Chain choreography and combat hooks** | Named-character pair/trio requirements; first response checkpoints; trigger when chain members/guards survive; cost discounts; one-time effect against same target | `CS1-001` Sora; `CS1-023` Ephemer; `CS1-284` Trinity Limit Preparation; `CS1-297` Reaction Command; `CS1-312` Cross-Chain; `CS1-344` Chain Order; Finisher `CS1-478` All-Out Attack | Combat declaration participant snapshot, response-order checkpoint events, stable combat ID, chain-wide and per-participant modifiers, post-combat trigger queue. Current initial chain path is insufficient for full trigger ordering. |
| **Movement, Equipment, and Party deployment** | Standard/extra Add, return/bounce, revive/retrieve, gear detach/transfer/return, control of a destination | `CS1-286` Sea-Salt Reunion; `CS1-288` Dream Drop; `CS1-292` Link to Hearts; `CS1-296` Keyblade Graveyard Rally; `CS1-302` Steal; `CS1-303` Materia Exchange; `CS1-339` Blade Awakening | Zone movement API with ownership/controller preserved; protection and full-HP constraints; no implicit refund; new battlefield instance on re-entry; attached gear returns to owner on host departure; apply the existing subtype re-check only at a new attachment. |
| **Finisher trigger programs** | Finisher on a specific attack/guard; once-per-combat/name caps; mixed damage, Equipment movement, post-combat costs | `CS1-463` Ragnarok; `CS1-464` Salvation; `CS1-465` Event Horizon; `CS1-468` Supernova; `CS1-472` Armiger Unleashed; `CS1-474` Zettaflare; `CS1-478` All-Out Attack; `CS1-482` Sacred Arrow | Trigger collection/activation windows; one Finisher per combat and name-per-turn counters; cost timing; mixed combat/effect damage; target legality at resolution; do not treat any as automatic victory. No Finisher currently has an executable program. |

## Work order

1. Implement transaction and choice primitives shared by all families: typed zones/resources, immutable physical-copy movement, structured pending instruction, legal choices, and atomic costs. Add reducer tests for no partial payment on rejected actions.
2. Implement static target and condition evaluators over exact card definitions/subtype sets. Keep “untransformed,” “Party Member,” “current HP,” “printed ATK,” franchise count, and exact instance identity distinct.
3. Add general resource and hand operations, then top-of-deck look/reveal/selection/reorder. These are relatively composable and enable the user's desired combo construction.
4. Add generic Menu interruption/partial negation, then event collection and delayed resolution. Do not silently skip independent instructions when only one target portion is negated.
5. Add combat checkpoints and post-combat trigger batches; then map combo hooks and Finishers.
6. Add movement/transformation only after core movement lifecycle and unresolved transformation details U002–U003 are addressed. Protection/suspension and control-transfer text waits on explicit layer/control APIs rather than guessed behavior.

## First high-value executable cohort

Recommended candidates because they express deck identity and interaction, not just stat tuning:

- **Deck building / selection:** `CS1-004`, `CS1-014`, `CS1-024`, `CS1-285`, `CS1-287`, `CS1-290`, `CS1-320`, `CS1-339`, `CS1-387`.
- **Resources and cross-franchise chain setup:** `CS1-001`, `CS1-023`, `CS1-289`, `CS1-298`, `CS1-311`, `CS1-312`, `CS1-316`, `CS1-318`, `CS1-319`, `CS1-344`.
- **Open-Menu interaction:** `CS1-323`, `CS1-392`, `CS1-395`, `CS1-400`, `CS1-410`, `CS1-418`, `CS1-425`, `CS1-428`, `CS1-438`, `CS1-440`, `CS1-447`, `CS1-456`.
- **Finisher patterns after trigger and combat substrate:** `CS1-463`, `CS1-464`, `CS1-465`, `CS1-468`, `CS1-472`, `CS1-474`, `CS1-478`, `CS1-482`.

These are candidates for implementation mapping only. The engine must compare every proposed mapping to the canonical source sentence and add tests for the printed targeting, timing, cost, and cleanup clauses before the card is counted as implemented. Do not bulk-label an entire family covered because one simple card runs.

## Counted observations

- Canonical distribution: 180 Characters, 100 Equipment, 110 Abilities, 70 Speed Abilities, 40 Finishers.
- Current explicit effect programs: 2 of 500 (`CS1-281` and `CS1-433`); every other effect remains blocked.
- A literal keyword scan of the 498 unsupported effect texts finds: 261 with a timing/event phrase, 54 with top-deck/reveal/search wording, 35 with draw/hand-add wording, 40 with discard/hand-send wording, 58 with resource wording, 47 with negation/cancel wording, 45 with movement/Equipment/Party wording, 116 with damage wording, 113 with heal wording, and 151 with Chain/Guard/cross-franchise wording. These categories overlap and include conditional/complex clauses; they are not counts of cards that can be implemented by a one-line template.
- There is a large stat-text surface (172 records mention ATK/HP), but that does not justify prioritizing stat-only support. Search/hand/resource/response and chain families should anchor the early expansion to match the user's design direction.

## Known dependencies and limits

- Rule source is `data/source/master-rulebook.md`, with implementation gaps detailed in `docs/rules-engine-contract.md`. Open details U001–U010 remain authoritative.
- The effect corpus has not had fresh per-card rules review or balance review. Do not claim balance from prose notes or a green structural test.
- Effect text is canonical data, not itself an executable specification. Any card whose sentences cannot be mapped without inventing timing, target, choice, or ordering behavior stays disabled pending a rules decision.
- Artwork is independent from gameplay coverage. Local images are not included unless redistribution permission is established; source URLs and credit do not prove that right.
