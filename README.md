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

The current engine executes two healing effects, two resource combo effects, Blade Awakening's hand-to-Party line, and Mickey's defeat trigger alongside setup, standard deployment, compatible Equipment, response Menus, turn resources and an initial chain-combat path. Empty phase windows require two consecutive passes. Combat declares all guards before attacker-first responses, commits damage together, and revives a defeated Main as a fresh instance while returning its Equipment. The eight registered transformations have explicit entry checks, Main base reservation and defeat restoration. Effect and trigger rules execute only through explicit programs; unregistered rules text is not interpreted. The forms' printed abilities and most other unsupported effects remain blocked. The build is not a complete implementation of the rulebook.

## Artwork

Card image source records are imported for provenance. The local app displays placeholders unless a file has approved redistribution rights; the imported artwork sources do not establish those rights.
