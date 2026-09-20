# 明トラ伝承プロジェクト

User-supplied original artwork: card back, Tanzen (joker), and ace of spades.
The photographs/scans are preserved as supplied. The reference group photograph
is not a card asset. Other card faces are built from the standard SVG artwork with white paper,
charcoal/crimson ink, muted costume colours and serif rank labels. The standard
design remains unchanged. Suit silhouettes use 58% width and 72% height,
centred on their existing positions without the original outline strokes.

`shared/game-client/card-art.ts` owns the artwork selection.
`densho-rendering.json` owns the print-trim rectangles and output widths.
Original JPGs remain unchanged. To verify their archived web copies:

```sh
node shared/game-client/scripts/sync-densho-assets.mjs
node shared/game-client/scripts/sync-densho-assets.mjs --check
```

The palette and lettering recipe lives in `scripts/densho-style.mjs`. Rebuild
and verify all 54 images (53 faces plus the back) with:

```sh
node shared/game-client/scripts/build-densho-cards.mjs
node shared/game-client/scripts/build-densho-cards.mjs --check
```

Web and mobile use lossless WebP renders at widths 90, 180 and 630 pixels.
The builder crops the three supplied scans and downsamples with Lanczos3;
thumbnail variants receive a mild edge adjustment after resizing. Nothing is
redrawn or synthesized. Other faces are rasterized from the existing styled SVGs.
Mobile selects the smallest variant at or above the card's physical pixel width
(layout width times PixelRatio); unknown widths use the largest variant.
Web uses the largest render and preloads all 54 images. A generated revision
changes image URLs when the source or recipe changes, avoiding mixed cached art.
The manifest tracks source, recipe and every output hash, while the generated
mobile registry keeps Metro imports static. CI verifies all sizes and web/mobile
synchronization without rerendering fonts. The combined size budget is 3 MB.
