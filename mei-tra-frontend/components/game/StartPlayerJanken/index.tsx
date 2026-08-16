'use client';

import { useTranslations } from 'next-intl';
import type {
  FirstTurnRevealStep,
  JankenHand,
} from '@meitra/game-client/first-turn-reveal';
import type { SeatPosition } from '@/lib/utils/tableOrder';
import styles from './index.module.scss';

export interface RevealSeat {
  seatId: string;
  name: string;
  position: SeatPosition;
}

interface StartPlayerJankenProps {
  step: FirstTurnRevealStep;
  seats: RevealSeat[];
  /** Seat that loses the janken and blows first. */
  firstTurnSeatId: string;
}

const HAND_GLYPHS: Record<JankenHand, string> = {
  rock: '✊',
  scissors: '✌️',
  paper: '✋',
};

export function StartPlayerJanken({
  step,
  seats,
  firstTurnSeatId,
}: StartPlayerJankenProps) {
  const t = useTranslations('game.firstTurnReveal');

  const firstTurnName =
    seats.find((seat) => seat.seatId === firstTurnSeatId)?.name ?? '';

  const caption =
    step.kind === 'result'
      ? t('result', { name: firstTurnName })
      : step.kind === 'chant'
        ? t('chant')
        : step.kind === 'ready'
          ? t('ready')
          : step.kind === 'draw'
            ? t('draw')
            : t('shu');

  return (
    <div className={styles.overlay} aria-live="polite">
      {seats.map((seat) => {
        const hand = step.hands?.[seat.seatId];
        const isFirstTurn = seat.seatId === firstTurnSeatId;

        return (
          <div
            key={seat.seatId}
            className={`${styles.hand} ${styles[seat.position]} ${
              step.kind === 'result' && isFirstTurn ? styles.handWinner : ''
            }`}
          >
            <span
              className={`${styles.glyph} ${hand ? '' : styles.glyphWaiting}`}
            >
              {hand ? HAND_GLYPHS[hand] : HAND_GLYPHS.rock}
            </span>
          </div>
        );
      })}

      <div
        className={`${styles.caption} ${
          step.kind === 'result' ? styles.captionResult : ''
        }`}
      >
        {caption}
      </div>
    </div>
  );
}
