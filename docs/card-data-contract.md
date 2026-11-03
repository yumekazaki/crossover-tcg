# Card-data module contract

The canonical card definitions are the 500 imported records in `data/cards.json`. Preserve each card's identifier and complete source text.

`src/data/cards.js` will export:

- `allCards()`
- `getCard(id)`
- `searchCards(query, filters = {})` with franchise/type/subtype/rarity/cost/keyword filters
- `validateDeck({mainIds, equipmentIds})` enforcing 40–60 Main, 20 Equipment/Transformation slots, no more than 3 copies of the same exact card ID across both decks (D001), and no more than 6 Finishers in Main
- `getArtwork(card)`, which returns a local image only when redistribution approval is explicit and the file exists; otherwise returns a labeled placeholder plus the recorded source citation

Artwork must be unique to the represented card identity. A Character card must show that Character individually, not a group or Organization image used as a substitute. Alternate forms need matching form-specific art. Use official/licensed artwork only when local redistribution rights are established; otherwise keep the labeled placeholder. Never reuse an image across card records or substitute unlicensed fan art.

No card record is silently synthesized.
