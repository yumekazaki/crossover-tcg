# Crossover TCG application dashboard

## Isolation and sources

- New independent local Git repository: initialized.
- Vanguard project: untouched; never used as the workspace or baseline.
- Rules, decision history, registries and complete card database: imported from the current crossover design workspace.
- GitHub repository: not created or connected; requires confirming/creating the new `crossover-tcg` destination before any GitHub mutation.
- Card art files: not copied because source records do not establish redistribution permission.

## Delivery status

| System | Planned | Implemented | Validated | Tested |
|---|---|---|---|---|
| Rules engine | Yes | Partial: setup, mulligan, two-pass empty phase windows, deployment, one free Center switch per turn, six-Momentum Party Swap with printed-cost refund, compatible Equipment, healing and combat response interruption, three combo resource/deployment effects, and Mickey's defeat trigger; combat guard window, attacker-first response priority, simultaneous HP/life commit, fresh-instance Main revival, and all eight registered transformation entry paths | Covered paths pass 26 engine tests; full rule audit not passed | Partial automated tests only |
| 500-card source data | Yes | Yes (imported) | Structural checks pass; semantic and balance review remain open | No full set playtesting |
| Local playable interface | Yes | Yes: card browser, deck builder and shared-device practice prototype | UI component checks pass; live local app launch blocked by this environment's loopback socket restriction | No full-game playtest |
| Deck builder | Yes | Yes: create/save/import/export/search and exact legality checks | 16 data tests and 16 UI browser checks pass | Not separately playtested |
| Practice AI | Yes | No | No | No |
| Accounts / online multiplayer | Yes | No | No | No |
| Deployment | Yes | No | No | No |

Engine activated-effect coverage is **7 of 500** (`CS1-281`, `CS1-316`, `CS1-319`, `CS1-339`, `CS1-394`, `CS1-433`, `CS1-436`); a separate explicit trigger program covers Mickey (`CS1-011`). Curaga Response heals a combat Healer and one allied combat Character; Soul Sever interrupts opponent combat healing before it resolves, and Curaga's conditional Momentum is awarded after the Menu closes. These response effects have automated coverage but are not playtested or balance-reviewed. The other card effects and triggers remain unsupported. The engine records last-known battlefield/Equipment snapshots for combat defeat events, queues eligible trigger groups FIFO, opens response Menus in turn-player placement order, and pauses resolving Menus for mandatory choices without granting priority. Mickey's trigger heals the current Main and, with no Party Members, draws then requires a player-selected discard. Party Swap passes leave/return event snapshots through the collector, though no current program matches those event types. Trigger coverage remains partial: event families, optional-trigger decisions, same-controller ordering choices, suspension, and pre-damage combat triggers are not complete. Aether Channel and Theurgy Charge add team-checked Light, Darkness and Momentum lines; Blade Awakening converts a Driver plus a hand cost into a suppressed Blade Party Member without consuming standard Add. Equipment attachment is implemented, but Equipment effects only run through explicit reviewed programs; none are registered yet. Eight canonical forms can enter play using explicit base, resource, entry-condition, reserve, Equipment-transfer and defeat/restore rules, but their printed form abilities and voluntary reversion are still unimplemented. Voluntary unequip, Finisher execution, full protection/suspension/control resolution, AI, accounts, online matches and deployment remain incomplete. Center switching and Party Swap resolve through response Menus; automated checks cover HP adjustment, per-turn use, Momentum payment, fresh hand instances, transformed-target rejection, and the unique printed-cost refund. The test suite currently has 42 checks (16 data, 26 engine). `docs/effect-coverage-plan.md` groups the remaining card text into proposed implementation families without marking those effects implemented. This dashboard distinguishes imported, implemented, validated, reviewed and actually played work.
