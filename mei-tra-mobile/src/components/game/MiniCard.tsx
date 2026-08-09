import { StyleSheet, Text, View } from 'react-native';

import { parseCard } from '@/lib/cards';
import { palette } from '@/theme/palette';
import { radius } from '@/theme/radius';

/**
 * A rank+suit chip, mirroring the web app's completed-field cards
 * (mei-tra-frontend/components/game/CompletedFields: .cardCorner).
 *
 * Won tricks are a tally, not something you read card by card, so web
 * deliberately drops the artwork here. Rendering full SVG faces at this size
 * was both noisier and more expensive than the information warranted.
 */
export function MiniCard({ card }: { card: string }) {
  const { rank, suit, isRed } = parseCard(card);
  const ink = isRed ? palette.card.red : palette.card.ink;

  return (
    <View accessibilityLabel={card} style={styles.chip}>
      <Text style={[styles.rank, { color: ink }]}>{rank}</Text>
      <Text style={[styles.suit, { color: ink }]}>{suit || '★'}</Text>
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
