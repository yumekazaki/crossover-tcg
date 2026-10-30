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
| Rules engine | Yes | Partial: setup, mulligan, deployment, compatible Equipment, two healing effects, response Menus, turn resources and initial chain combat | Covered paths pass 9 engine tests; full rule audit not passed | Partial automated tests only |
| 500-card source data | Yes | Yes (imported) | Structural checks pass; semantic and balance review remain open | No full set playtesting |
| Local playable interface | Yes | Yes: card browser, deck builder and shared-device practice prototype | UI component checks pass; live local app launch blocked by this environment's loopback socket restriction | No full-game playtest |
| Deck builder | Yes | Yes: create/save/import/export/search and exact legality checks | 16 data tests and 16 UI browser checks pass | Not separately playtested |
| Practice AI | Yes | No | No | No |
| Accounts / online multiplayer | Yes | No | No | No |
| Deployment | Yes | No | No | No |

Engine effect coverage is **2 of 500** cards; all other effects are explicitly unsupported and blocked. Transformation, Finisher execution, full triggers/protection/suspension/control resolution, AI, accounts, online matches and deployment remain incomplete. This dashboard distinguishes imported designs from implemented, validated, reviewed and actually played functionality.
