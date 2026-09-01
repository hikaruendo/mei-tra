import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

// Metro resolves require at build time, so the specifier has to be a literal.
// The file is a copy of the web app's source of truth, kept current by
// `npm run assets:table` and checked in CI. Relative rather than `@/assets/*`
// for the same reason as card-art-assets.ts: the tsconfig alias overlaps with
// `@/*` -> `src/*`, and only the relative form satisfies metro, tsc and jest.
const ZABUTON = require('../../../assets/table/zabuton-nishijin.webp');

/**
 * 西陣織の座布団, laid under the trick. The cushion is on the table for the
 * whole hand, so this renders whether or not a card has been played — the
 * field is emptied every time a trick completes.
 *
 * It carries no size of its own: it fills its parent, and `GameBoard` sizes
 * that parent square from `useFieldMatSize`. That is deliberate. The previous
 * version took a `size` prop set from a constant larger than the box it sat
 * in, so it overhung its parent and only drew because RN views do not clip.
 * With one owner of the number, that cannot happen.
 *
 * The artwork is a render of a three.js scene, not a drawing — see
 * `mei-tra-frontend/scripts/build-table-art.mjs`. The cushion has thickness,
 * so only `FACE_HEIGHT` of this box is top face that a card can rest on.
 */
export function FieldMat() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.mat}
    >
      <Image contentFit="contain" source={ZABUTON} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  mat: StyleSheet.absoluteFillObject,
});
