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
| Rules engine | Yes | Partial: setup, mulligan, two-pass empty phase windows, deployment, one free Center switch per turn, six-Momentum Party Swap with printed-cost refund, compatible Equipment, two healing and two combo-resource effects, combat guard window, attacker-first response priority, simultaneous HP/life commit, fresh-instance Main revival, and all eight registered transformation entry paths | Covered paths pass 22 engine tests; full rule audit not passed | Partial automated tests only |
| 500-card source data | Yes | Yes (imported) | Structural checks pass; semantic and balance review remain open | No full set playtesting |
| Local playable interface | Yes | Yes: card browser, deck builder and shared-device practice prototype | UI component checks pass; live local app launch blocked by this environment's loopback socket restriction | No full-game playtest |
| Deck builder | Yes | Yes: create/save/import/export/search and exact legality checks | 16 data tests and 16 UI browser checks pass | Not separately playtested |
| Practice AI | Yes | No | No | No |
| Accounts / online multiplayer | Yes | No | No | No |
| Deployment | Yes | No | No | No |

Engine card-effect coverage is **4 of 500** (`CS1-281`, `CS1-316`, `CS1-319`, `CS1-433`); every other card effect remains unsupported and blocked. Aether Channel and Theurgy Charge add two combo resource lines with character-pair checks, a hand-to-deck activation cost, and turn-long restrictions. Equipment attachment is implemented, but Equipment effects only run through explicit reviewed programs; none are registered yet. Eight canonical forms can enter play using explicit base, resource, entry-condition, reserve, Equipment-transfer and defeat/restore rules, but their printed form abilities and voluntary reversion are still unimplemented. Trigger processing (including Party Swap leave/return triggers), voluntary unequip, Finisher execution, full protection/suspension/control resolution, AI, accounts, online matches and deployment remain incomplete. Center switching and Party Swap resolve through response Menus; automated checks cover HP adjustment, per-turn use, Momentum payment, fresh hand instances, transformed-target rejection, and the unique printed-cost refund. The test suite currently has 38 checks (16 data, 22 engine). `docs/effect-coverage-plan.md` groups the remaining card text into proposed implementation families without marking those effects implemented. This dashboard distinguishes imported, implemented, validated, reviewed and actually played work.
