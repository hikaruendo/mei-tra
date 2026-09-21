# Meitra brand assets

The canonical artwork is the unchanged [Densho ace of spades](../game-client/assets/densho/A_S.jpg). `build-assets.mjs` crops its central black spade and gold face, preserving the RGB values of every retained source pixel. A colour mask removes the surrounding white and cool grey lettering. No artwork is redrawn or recoloured.

Run from either client workspace:

```sh
npm run assets:brand
npm run assets:brand:check
```

The generator writes the transparent master here, mobile icons/splash/header under `mei-tra-mobile/assets/images`, and Web metadata icons and header under `mei-tra-frontend`. Do not edit generated images independently. The manifest checks source, recipe and output hashes without requiring identical PNG encoders across operating systems. Tests check source fidelity, unclipped edges, Android safe area, iOS opacity, shared header pixels and favicon sizes.

The iOS icon is an opaque 1024 px white square. Android uses a transparent foreground inside the central safe circle and a white background configured in `app.json`. The splash uses the same motif centered on white. Web and mobile headings retain the Meitra wordmark beside the mark.

App icon and splash changes require a new native build. Verify the splash in a preview or production build; Expo Go and Expo Web do not establish native splash correctness. See the [Expo guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
