# Card artwork pipeline

## Live status

Card artwork is live in the library, card detail and local match views. The original set has 159 distinct local images; the Harry Potter (Anime) set adds 22 new AI-generated images covering all Character cards, including Harry, Draconia, their shared cards and the wider cast. Each path belongs to one card. Set 02 Equipment, Abilities, Speed Abilities and Finishers still show named pending-art placeholders. Original-set image provenance is recorded in the existing artwork manifest; AI-generated assets have their own manifest.

## Display contract

Each card uses its own artwork record and unique file in public/artwork/. Set 01 records remain in data/cards.json; Set 02 records live in data/sets/harry-potter-anime.json. The browser displays a local image only when permission is recorded, the file exists, and the path is unique. Source URLs are kept as credits and provenance; the site does not hotlink artwork.

## Adding a remaining image

1. Add one correctly matched image for the exact character, form, equipment, or action to public/artwork/.
2. Record source, creator or publisher credit and permission in data/source/artwork-manifest.json.
3. Set that card's unique artwork.local_asset_path and artwork.redistribution_approved fields.
4. Keep Organization/group images off individual Character cards and do not reuse image paths.
