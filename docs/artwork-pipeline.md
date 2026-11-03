# Card artwork pipeline

## Display contract

All image references belong to an individual card's `artwork` object in `data/cards.json`. An image is displayable only when its record explicitly sets `redistribution_approved: true`, its `local_asset_path` resolves inside `public/`, the file exists and is an image, and the resolved path is unique across approved cards. `status: "attached"`, a credit, a source URL, or a source page does not grant permission. Remote image URLs are never loaded by the app.

The same `getArtwork(card)` gate is used in card-library tiles, the selected-card detail panel, and the local-match card dialog. When any check fails, those views show a named pending-art placeholder. The source page is available as provenance in the card detail view.

## Adding an approved image

1. Obtain a distinct image for the exact card character, form, equipment, or action. Do not substitute group artwork for an individual character, reuse an image on multiple cards, or imply an image shows a different canonical form.
2. Confirm the right to redistribute the image with the public playtest site. Record who created it, the license or permission, and the requested credit. A search result or source citation alone is not approval.
3. Put the image in `public/artwork/` and reference its relative path in the matching card record's `artwork.local_asset_path`.
4. Set `artwork.redistribution_approved` to `true` only after permission is recorded in the manifest. Keep the canonical source URL, source page, attribution, and card-specific identity verification with that manifest entry.
5. Check that the art is unique to that card and matches its depicted form. The loader withholds repeated paths even if multiple records are marked approved.

## Current inventory

The imported manifest lists 163 attached source records and 337 pending records. The repo contains no local art files and has no permission record for the imported images, so 0 of 500 cards display image files. Every card currently renders its own clearly labeled placeholder. No official or fan artwork is included in the public site until its redistribution permission is documented.
