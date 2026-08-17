'use client';

import { useTranslations } from 'next-intl';
import {
  JANKEN_HAND_PATHS,
  type FirstTurnRevealStep,
  type JankenHand,
} from '@meitra/game-client/first-turn-reveal';
import styles from './index.module.scss';

export interface RevealSeat {
  seatId: string;
  name: string;
}

interface StartPlayerJankenProps {
  step: FirstTurnRevealStep;
  seats: RevealSeat[];
  /** Seat that wins the janken and blows last (吹き上げ). */
  lastBlowSeatId: string;
}

function HandGlyph({ hand }: { hand: JankenHand }) {
  return (
    <svg viewBox="0 0 64 64" className={styles.glyph} aria-hidden="true">
      {JANKEN_HAND_PATHS[hand].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function StartPlayerJanken({
  step,
  seats,
  lastBlowSeatId,
}: StartPlayerJankenProps) {
  const t = useTranslations('game.firstTurnReveal');

  const nameOf = (seatId: string) =>
    seats.find((seat) => seat.seatId === seatId)?.name ?? '';

  const isResult = step.kind === 'result';
  const caption =
    step.kind === 'chant'
      ? t('chant')
      : step.kind === 'ready'
        ? t('ready')
        : t('shu');

  return (
    <div className={styles.overlay} aria-live="polite">
      {!isResult && (
        // Keyed by step so the punch-in restarts on every beat.
        <div
          key={step.kind}
          className={`${styles.chant} ${
            step.kind === 'chant' ? styles.chantSoft : styles.chantPunch
          }`}
        >
          {caption}
        </div>
      )}

      <div className={styles.cards}>
        {seats.map((seat) => {
          const hand = step.hands?.[seat.seatId] ?? 'rock';
          const isWinner = seat.seatId === lastBlowSeatId;

          return (
            <div
              key={seat.seatId}
              className={`${styles.card} ${
                isResult
                  ? isWinner
                    ? styles.cardWinner
                    : styles.cardDim
                  : ''
              }`}
            >
              {/* Keyed by step so the throw snap replays on every beat. */}
              <div
                key={step.kind}
                className={
                  step.kind === 'chant' ? styles.handWindup : styles.handThrow
                }
              >
                <HandGlyph hand={hand} />
              </div>
              <div className={styles.name}>{seat.name}</div>
            </div>
          );
        })}
      </div>

      {isResult && (
        <div className={styles.result}>
          <div className={styles.verdict}>
            {t('result', { name: nameOf(lastBlowSeatId) })}
          </div>
        </div>
      )}
    </div>
  );
}
