import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { resolveCardArt } from '@/lib/card-art-assets';
import { colors } from '@/theme/colors';
import {
  CARD_BASE_WIDTHS,
  cardHeight,
  cardRadius,
  type CardSize,
} from '@/theme/cards';
import { shadows } from '@/theme/shadows';
import { t } from '@/i18n';

interface PlayingCardProps {
  card?: string;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** Named size preset. Ignored when `width` is given. */
  size?: CardSize;
  /** Explicit width; the hand fan uses this to fit the screen. */
  width?: number;
  onPress?: () => void;
}

function accessibilityLabelFor(card: string | undefined, faceDown: boolean) {
  if (faceDown) return t('a11y.faceDownCard');
  if (card === 'JOKER') return t('a11y.joker');
  return card;
}

function PlayingCardComponent({
  card,
  faceDown = false,
  selected = false,
  disabled = false,
  size = 'hand',
  width,
  onPress,
}: PlayingCardProps) {
  const w = width ?? CARD_BASE_WIDTHS[size];
  const h = cardHeight(w);
  const radius = cardRadius(w);
  const art = resolveCardArt(card ?? '', faceDown);

  return (
    <Pressable
      accessibilityHint={
        onPress && !disabled ? t('a11y.tapToSelectCard') : undefined
      }
      accessibilityLabel={accessibilityLabelFor(card, faceDown)}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ disabled, selected }}
      disabled={disabled || !onPress}
      onPress={onPress}
      // The ring and shadow live outside the clipping view so that selecting a
      // card does not crop the artwork.
      style={[
        { width: w, height: h, borderRadius: radius },
        selected ? styles.selected : styles.resting,
        selected && { borderRadius: radius, transform: [{ scale: 1.06 }] },
      ]}
    >
      <View style={[styles.clip, { borderRadius: radius }]}>
        {art.kind === 'vector' ? (
          <art.Svg height="100%" width="100%" />
        ) : (
          <Image
            contentFit="cover"
            source={art.source}
            style={StyleSheet.absoluteFill}
          />
        )}
        {disabled ? (
          // Web dims with `filter: brightness(.45) saturate(.3)`, which React
          // Native has no dependable cross-platform equivalent for. A scrim
          // reads far closer than `opacity`, which would let the felt show
          // through and make the card look translucent instead of dimmed.
          <View pointerEvents="none" style={styles.disabledScrim} />
        ) : null}
      </View>
    </Pressable>
  );
}

export const PlayingCard = memo(PlayingCardComponent);

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  resting: shadows.card,
  selected: {
    ...shadows.cardSelected,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  disabledScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cardDisabled,
  },
});
