import { StyleSheet, View } from 'react-native';

// Metro resolves require at build time, so the specifier has to be a literal.
// The file is a copy of the web app's source of truth, kept current by
// `npm run assets:table` and checked in CI. Relative rather than `@/assets/*`
// for the same reason as card-art-assets.ts: the tsconfig alias overlaps with
// `@/*` -> `src/*`, and only the relative form satisfies metro, tsc and jest.
import Zabuton from '../../../assets/table/zabuton-nishijin.svg';

/**
 * 西陣織の座布団, laid under the trick. The cushion is on the table for the
 * whole hand, so this renders whether or not a card has been played — the
 * field is emptied every time a trick completes.
 *
 * Sized off the played-card cross rather than the field box: the artwork keeps
 * a small margin inside its own viewBox for the tassels and drop shadow, so
 * the painted cushion comes out a little under this size, and that is what has
 * to contain the cards.
 */
export function FieldMat({ size }: { size: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.mat, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}
    >
      <Zabuton height="100%" width="100%" />
    </View>
  );
}

const styles = StyleSheet.create({
  mat: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
});
