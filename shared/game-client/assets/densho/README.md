# 明トラ伝承プロジェクト

User-supplied original artwork: card back, Tanzen (joker), and ace of spades.
The photographs/scans are preserved as supplied. The reference group photograph
is not a card asset. Other card faces are built from the standard SVG artwork with white paper,
charcoal/crimson ink, muted costume colours and serif rank labels. The standard
design remains unchanged. SVG suit silhouettes use 82% width and 72% height;
the two corner suits use 90% width and 84% height for legibility at small sizes.
All suits, including those within court illustrations, keep their positions.
The SVG ranks are positioned from their rendered ink bounds so both corner
rank/suit pairs have a consistent 15px gap at 630px; the source SVGs are untouched.
The ace of spades scan is preserved as supplied; only its derived renders
widen the central black spade and enlarge the two corner spades horizontally to
match the SVG corner suit widths, while keeping their existing height.
The gold illustration and lettering retain their original position and proportions.
The central spade's derived outline covers the scan's grey edge pixels and
widens gradually at its tip, avoiding a doubled or stepped contour.
The lower spade keeps a narrow paper outline around the adjacent caption's final
letter so the word stays distinct from the wider suit.
The Tanzen scan is also preserved; its derived renders enlarge the thin
`anzen` letters by 20% and slightly thicken the two vertical labels. The large
`T`, figure, and suit symbols stay unchanged.

`shared/game-client/card-art.ts` owns the artwork selection.
`densho-rendering.json` owns the print-trim rectangles and output widths.
Original JPGs remain unchanged. To verify their archived web copies:

```sh
node shared/game-client/scripts/sync-densho-assets.mjs
node shared/game-client/scripts/sync-densho-assets.mjs --check
```

The SVG palette, lettering and suit recipe lives in `scripts/densho-style.mjs`,
and corner spacing in `scripts/densho-corner-spacing.mjs`;
the scanned ace adjustment lives in `scripts/densho-ace-spade.mjs`, and the
Tanzen lettering adjustment in `scripts/densho-tanzen.mjs`. Rebuild
and verify all 54 images (53 faces plus the back) with:

```sh
node shared/game-client/scripts/build-densho-cards.mjs
node shared/game-client/scripts/build-densho-cards.mjs --check
```

Web and mobile use lossless WebP renders at widths 90, 180 and 630 pixels.
The builder crops the three supplied scans and downsamples with Lanczos3;
thumbnail variants receive a mild edge adjustment after resizing. Other faces
are rasterized from the existing styled SVGs.
Mobile selects the smallest variant at or above the card's physical pixel width
(layout width times PixelRatio); unknown widths use the largest variant.
Web uses the largest render and preloads all 54 images. A generated revision
changes image URLs when the source or recipe changes, avoiding mixed cached art.
The manifest tracks source, recipe and every output hash, while the generated
mobile registry keeps Metro imports static. CI verifies all sizes and web/mobile
synchronization without rerendering fonts. The combined size budget is 3 MB.
