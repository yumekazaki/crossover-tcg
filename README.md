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

The current engine executes a limited set of explicit effects and Specials, including Axel's discard-to-damage Special, Ashley's return-and-replace Special, Grace Ashcroft's reveal/resource/subtype-discount Special, cross-franchise Heart-to-Heart, Firaga effect damage, healing and resource combo effects, Blade Awakening's hand-to-Party line, and Mickey's defeat trigger. These run alongside setup, standard deployment, compatible Equipment, response Menus, turn resources and an initial chain-combat path. Empty phase windows require two consecutive passes. Combat declares all guards before attacker-first responses, commits damage together, and revives a defeated Main as a fresh instance while returning its Equipment. The eight registered transformations have explicit entry checks, Main base reservation and defeat restoration. Effect and trigger rules execute only through explicit programs; unregistered rules text is not interpreted. The forms' printed abilities and most other unsupported effects remain blocked. The build is not a complete implementation of the rulebook.

## Artwork

The browser playtest now renders card art in library tiles, card details and the local-match card dialog. It displays an image only when all of these are true: the card explicitly records redistribution approval, the image is stored inside `public/`, the local file exists and is an image, and no other card points at that same file. Remote links and source citations are provenance only; they are never used as display images.

There are currently **159 distinct images** in the site, all individually assigned and locally loaded. Character cards do not use group shots, and each image path belongs to one card. Artwork for the remaining cards is still pending and uses a named placeholder. The owner confirmed redistribution approval; source credits and local image paths are recorded in `data/source/artwork-manifest.json`. See [the artwork pipeline](docs/artwork-pipeline.md).
