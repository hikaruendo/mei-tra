import { Pressable, StyleSheet, Text, View } from 'react-native';

import { parseCard } from '@/lib/cards';
import { colors } from '@/theme/colors';

interface PlayingCardProps {
  card?: string;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPress?: () => void;
}

export function PlayingCard({
  card,
  faceDown = false,
  selected = false,
  disabled = false,
  compact = false,
  onPress,
}: PlayingCardProps) {
  const parsed = parseCard(card ?? 'JOKER');

  return (
    <Pressable
      accessibilityLabel={faceDown ? '裏向きのカード' : card}
      accessibilityState={{ disabled, selected }}
      accessibilityHint={
        onPress && !disabled ? 'タップしてカードを選択します' : undefined
      }
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        styles.card,
        compact ? styles.compact : styles.regular,
        faceDown && styles.back,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      {faceDown ? (
        <View style={styles.backInner}>
          <Text style={styles.backMark}>M</Text>
        </View>
      ) : (
        <>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[
              styles.rank,
              compact && styles.compactRank,
              parsed.isRed && styles.red,
            ]}
          >
            {parsed.rank}
          </Text>
          <Text
            style={[
              styles.suit,
              compact && styles.compactSuit,
              parsed.isRed && styles.red,
            ]}
          >
            {parsed.suit || '★'}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d4d0c4',
    backgroundColor: colors.card,
    padding: 6,
    justifyContent: 'space-between',
    boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.24)',
    elevation: 4,
  },
  regular: {
    width: 58,
    height: 84,
  },
  compact: {
    width: 42,
    height: 60,
    padding: 4,
    borderRadius: 6,
  },
  rank: {
    color: colors.cardText,
    fontSize: 21,
    fontWeight: '800',
  },
  compactRank: {
    fontSize: 15,
  },
  suit: {
    color: colors.cardText,
    fontSize: 25,
    textAlign: 'center',
  },
  compactSuit: {
    fontSize: 18,
  },
  red: {
    color: colors.redSuit,
  },
  back: {
    backgroundColor: '#133f36',
    borderColor: colors.gold,
    padding: 4,
  },
  backInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  backMark: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  selected: {
    borderColor: colors.gold,
    borderWidth: 3,
    transform: [{ translateY: -8 }],
  },
  disabled: {
    opacity: 0.44,
  },
});
