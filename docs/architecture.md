# Application architecture — initial decision

## Independent boundary

This is a new local Git repository rooted at `C:/Users/yumek/Documents/Codex/Crossover-TCG`. It is not a worktree, branch, or copy of the Vanguard repository. No Vanguard files, settings, branches, database, deployment, or remotes are used. GitHub creation/publication is a later, separately verified step; no GitHub changes have been made.

## Chosen shape

- **Authoritative data:** `data/cards.json`, copied from the frozen design set; code reads these records rather than inventing temporary card IDs. Rules source and approved decision history are copied into `data/source/`.
- **Game engine:** JavaScript modules in `src/engine`, independent from the UI. `dispatch(state, action, cards)` clones state, validates the command and returns the next state, or throws a typed `RuleError`; no UI code mutates game state directly.
- **Card access:** `src/data` provides canonical lookup, search, deck checks and card images. Artwork source metadata is preserved; files are not redistributed without permission, so the UI uses marked placeholders by default.
- **Interface:** `src/ui` renders the searchable card pool and deck builder; `src/app.js` connects it to the local two-seat practice slice. This is a local prototype, before online accounts or matchmaking.
- **Persistence/network (later):** a separate server will own game state and validate every online action. The browser will be an untrusted client. Auth, Postgres persistence, WebSocket synchronization, invitations, reconnect handling and match history are not implemented in this milestone. Secrets will remain server-side.
- **Practice AI (later):** AI consumes the same legal-action list as a human player and submits ordinary actions through the same validator.

## Vertical-slice boundary

The initial playable loop is: choose two legal decks, initialize both players, take turns, add Characters, attach Equipment, activate implemented Abilities/Speed Abilities, resolve a combat Menu, apply combat damage and defeat rules, and determine victory. Card effects not yet supported by the generic resolver must be visibly marked unsupported and blocked from resolving; the app must never pretend text-only behavior was executed.

## Shared module contract

- `createInitialState({players, firstPlayerId, chooserId, seed, cards}) -> GameState`
- `getLegalActions(state, playerId) -> Action[]`
- `dispatch(state, action, cards) -> GameState | throws RuleError`
- `loadCards()` loads the canonical JSON once; `allCards()` and `getCard(cardId)` read the cache after initialization.
- `searchCards(query, filters) -> CardRecord[]`
- `validateDeck(mainIds, equipmentIds) -> DeckValidation`

The rules registry remains authoritative. Unsupported card effects do not license changing the rules; implementation gaps are tracked in the dashboard.
