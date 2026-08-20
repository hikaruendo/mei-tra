import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { resolveCardArt } from '@/lib/card-art-assets';
import { parseCard } from '@/lib/cards';
import { palette } from '@/theme/palette';
import { radius } from '@/theme/radius';
import { t } from '@/i18n';

/**
 * A rank+suit chip, mirroring the web app's completed-field cards
 * (mei-tra-frontend/components/game/CompletedFields: .cardCorner).
 *
 * Won tricks are a tally, not something you read card by card, so web
 * deliberately drops the artwork for ordinary cards. JOKER is its one
 * exception, and this follows it — see below.
 */
export function MiniCard({ card }: { card: string }) {
  const { rank, suit, isRed } = parseCard(card);
  const ink = isRed ? palette.card.red : palette.card.ink;

  // JOKER has no rank/suit pair to print, so web drops the text treatment and
  // stretches the artwork across the chip instead (TakenCardPreview ->
  // .jokerCardFace, an <img> at 100%/100%, i.e. object-fit: fill).
  // preserveAspectRatio="none" is what reproduces that fill on the SVG side.
  if (card === 'JOKER') {
    const art = resolveCardArt(card);
    return (
      <View accessibilityLabel={t('a11y.joker')} style={styles.chip}>
        {/* The clip lives on an inner view, as in PlayingCard: `overflow:
            hidden` on the chip itself would set masksToBounds and swallow the
            iOS layer shadow, which is painted outside the layer bounds. */}
        <View style={styles.artClip}>
          {art.kind === 'vector' ? (
            <art.Svg height="100%" preserveAspectRatio="none" width="100%" />
          ) : (
            <Image
              contentFit="fill"
              source={art.source}
              style={StyleSheet.absoluteFill}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View accessibilityLabel={card} style={styles.chip}>
      <Text style={[styles.rank, { color: ink }]}>{rank}</Text>
      <Text style={[styles.suit, { color: ink }]}>{suit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 22,
    height: 28,
    // Web's .cardCorner uses margin: 0 -0.16rem — barely overlapping, so every
    // card in a won set stays readable. A face-down-style stack would hide all
    // but the last one.
    marginHorizontal: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border.hairline,
    backgroundColor: palette.card.face,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1,
    elevation: 1,
  },
  artClip: {
    ...StyleSheet.absoluteFillObject,
    // Web's .cardCorner clips with overflow: hidden so the joker artwork takes
    // the chip's rounded corners instead of squaring them off.
    overflow: 'hidden',
    borderRadius: radius.sm,
  },
  rank: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 12,
  },
  suit: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 13,
  },
});
