# 明トラ伝承プロジェクト

User-supplied original artwork: card back, Tanzen (joker), and ace of spades.
The photographs/scans are preserved as supplied. The reference group photograph
is not a card asset. Other card faces continue to use the standard deck.

`shared/game-client/card-art.ts` owns the artwork selection and print-trim
viewports. Web and mobile render the same originals through these viewports.
Mobile imports these files directly. To copy them to the web public directory:

```sh
node shared/game-client/scripts/sync-densho-assets.mjs
node shared/game-client/scripts/sync-densho-assets.mjs --check
```
