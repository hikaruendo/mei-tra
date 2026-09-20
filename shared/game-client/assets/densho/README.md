# 明トラ伝承プロジェクト

User-supplied original artwork: card back, Tanzen (joker), and ace of spades.
The photographs/scans are preserved as supplied. The reference group photograph
is not a card asset. Other card faces are built from the standard SVG artwork with white paper,
charcoal/crimson ink, muted costume colours and serif rank labels. The standard
design remains unchanged. Suit silhouettes use 58% width and 72% height,
centred on their existing positions without the original outline strokes.

`shared/game-client/card-art.ts` owns the artwork selection and print-trim
viewports. Web and mobile render the same originals through these viewports.
Mobile imports these files directly. To copy them to the web public directory:

```sh
node shared/game-client/scripts/sync-densho-assets.mjs
node shared/game-client/scripts/sync-densho-assets.mjs --check
```

The palette and lettering recipe lives in `scripts/densho-style.mjs`. Rebuild
and verify the 51 matching faces with:

```sh
node shared/game-client/scripts/build-densho-cards.mjs
node shared/game-client/scripts/build-densho-cards.mjs --check
```

Web and mobile use identical 3x WebP renders. The manifest tracks source, recipe
and output hashes, while the generated mobile registry keeps Metro imports
static. CI verifies coverage and synchronization without rerendering fonts.
