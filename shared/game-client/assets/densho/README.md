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
match the SVG corner suit widths.
The gold illustration and lettering retain their original position and proportions.
Only paper connected to the exterior of the central spade is eligible for
widening. Gold pixels and their neighbouring fine outlines are protected.
The derived outline covers the scan's grey edge pixels and widens gradually
at its tip, avoiding a doubled or stepped contour.
The lower spade keeps a narrow paper outline around the adjacent caption's final
letter so the word stays distinct from the wider suit.
The Tanzen scan is also preserved; its derived renders enlarge the thin
`anzen` letters by 20% and slightly thicken the two vertical labels. The large
`T`, figure, and suit symbols stay unchanged.

`shared/game-client/card-art.ts` owns the artwork selection.
`densho-rendering.json` owns the print-trim rectangles and output widths.
Original JPGs and generated WebPs are stored only in this shared directory.
Mobile imports the shared WebPs directly. Original JPGs remain unchanged.

The SVG palette, lettering and suit recipe lives in `scripts/densho-style.mjs`,
and corner spacing in `scripts/densho-corner-spacing.mjs`;
the scanned ace adjustment lives in `scripts/densho-ace-spade.mjs`, and the
Tanzen lettering adjustment in `scripts/densho-tanzen.mjs`. Rebuild
and verify all 54 images (53 faces plus the back) with:

```sh
node shared/game-client/scripts/build-densho-cards.mjs
node shared/game-client/scripts/build-densho-cards.mjs --check
```

Web uses only the 54 large images. `scripts/sync-densho-assets.mjs` copies
them byte-for-byte into the ignored `mei-tra-frontend/public/cards/densho/styled/`
directory before `npm run dev`, `npm run build`, and `npm run vercel-build`.
These public files are disposable build outputs, not a second tracked deck.
No original JPGs or unused thumbnail variants are copied to Web.
After regenerating shared images while a dev server is already running, run
`npm run assets:densho:web` in `mei-tra-frontend/` (or use `npm run assets:densho`
to regenerate and copy together). To verify the local public copies:

```sh
node shared/game-client/scripts/sync-densho-assets.mjs --check
```

The shared deck contains lossless WebP renders at widths 90, 180 and 630 pixels.
The builder crops the three supplied scans and samples each size directly from
the original with Lanczos3. Only edited pixels are composited as an overlay,
so unmodified illustration detail never passes through an intermediate 630px
image. Thumbnail variants receive a mild edge adjustment after resizing.
Other faces are rasterized from the existing styled SVGs.
Mobile selects the smallest variant at or above the card's physical pixel width
(layout width times PixelRatio); unknown widths use the largest variant.
Web uses the largest render and preloads all 54 images. A generated revision
changes image URLs when the source or recipe changes, avoiding mixed cached art.
The manifest tracks source, recipe and every output hash, while the generated
mobile registry keeps Metro imports static. CI verifies all shared image hashes,
corner spacing, preservation of illustration pixels, and provisioning a fresh
Web output directory. The shared deck size budget is 3 MB.
