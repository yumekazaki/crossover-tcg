# Crossover TCG

An independent implementation of the Crossover TCG design. This repository is separate from the Cardfight!! Vanguard project.

## Current milestone

The authoritative 500-card JSON pool and recovered rules have been imported. The first milestone is a local, rules-driven playable vertical slice with game state and legal action validation. See [the dashboard](docs/project-dashboard.md) and [architecture](docs/architecture.md).

## Run

Requires Node.js 20 or newer; there are no third-party runtime dependencies.

```sh
npm start
```

Open `http://127.0.0.1:4173`. This build supports local two-seat practice only. Run the automated checks with `npm test`.

The current engine executes two audited healing effects alongside setup, standard deployment, compatible Equipment, response Menus, turn resources and an initial chain-combat path. Other effect text remains visible in the catalogue but is marked unsupported and cannot resolve. The build is not a complete implementation of the rulebook.

## Artwork

Card image source records are imported for provenance. The local app displays placeholders unless a file has approved redistribution rights; the imported artwork sources do not establish those rights.
