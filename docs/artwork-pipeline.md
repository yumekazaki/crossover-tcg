# Card artwork pipeline

## Live status

Card artwork is live in the library, card detail and local match views. As of 2026-11-03, 159 of 500 cards have distinct local images, with individual-character images only on Character cards. The remaining cards show named pending placeholders. Group shots are excluded from Character cards, and no asset path is reused. The owner confirmed redistribution approval; source, publisher credit and local derivative are recorded in the manifest.

## Display contract

Each card uses its own artwork record in data/cards.json and unique file in public/artwork/. The browser displays a local image only when permission is recorded, the file exists, and the path is unique. Source URLs are kept as credits and provenance; the site does not hotlink artwork.

## Adding a remaining image

1. Add one correctly matched image for the exact character, form, equipment, or action to public/artwork/.
2. Record source, creator or publisher credit and permission in data/source/artwork-manifest.json.
3. Set that card's unique artwork.local_asset_path and artwork.redistribution_approved fields.
4. Keep Organization/group images off individual Character cards and do not reuse image paths.
