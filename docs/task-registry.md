# Workstream ownership

| Workstream | Owner | Files | Status |
|---|---|---|---|
| Rules source mapping | rules audit agent | docs/rules-engine-contract.md | Complete |
| Card data/deck API | card data agent | src/data/cards.js; tests/card-data.test.js | Complete; 16 checks pass |
| Card browser/deck builder panel | UI agent | src/ui/card-browser.js; src/ui/card-browser.css | Complete; 16 browser checks pass |
| Effect coverage taxonomy | effect audit agent | docs/effect-coverage-plan.md | Complete; proposed families only, no unsupported effect marked implemented |
| Engine gap audit | rules audit agent | docs/engine-audit-next.md | Complete; P0 combat fixes applied, further rules gaps retained |
| Engine and root integration | primary | src/engine/*; index.html; src/app.js; styles.css | Partial; 16 engine checks pass, including combat, transformation entry/defeat, and blocked unregistered gear effects |

Shared contracts are in docs/architecture.md, docs/card-data-contract.md and docs/ui-module-contract.md. Do not edit outside your assigned files.
