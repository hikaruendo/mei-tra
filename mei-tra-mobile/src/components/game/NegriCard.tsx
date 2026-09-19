import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { MiniCard } from '@/components/game/MiniCard';
import { t } from '@/i18n';

/**
 * A Negri set aside by a seat, shown as the web shows it
 * (mei-tra-frontend/components/game/NegriCard): face down, and a viewer who may
 * see it taps it to turn it into a rank-and-suit chip, then taps again to turn
 * it back. Both sides are MiniCard-sized, so flipping moves nothing around it.
 */
export function NegriCard({
  card,
  canReveal,
}: {
  card: string;
  /** Only the Negri's owner (or a spectator watching from that seat) may look. */
  canReveal: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  // A new Negri starts face down again.
  useEffect(() => setRevealed(false), [card]);

  if (!canReveal) {
    return <MiniCard card={card} faceDown />;
  }

  return (
    <Pressable
      accessibilityLabel={revealed ? t('a11y.hideNegri') : t('a11y.revealNegri')}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => setRevealed((value) => !value)}
      testID="negri-card"
    >
      <MiniCard card={card} faceDown={!revealed} />
    </Pressable>
  );
}
