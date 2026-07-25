import React from 'react';
import { useTranslations } from 'next-intl';
import { Player, Field } from '@/types/game.types';
import { getSeatOrderWithSelfBottom } from '@/lib/utils/tableOrder';
import { CardFace } from '@/components/game/CardFace';
import styles from './index.module.scss';

const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

interface GameFieldProps {
  currentField: Field | null;
  players: Player[];
  onBaseSuitSelect: (suit: string) => void;
  isCurrentPlayer: boolean;
  currentPlayerId: string;
}

function getCardSeatPosition(
  playedByPlayerId: string,
  orderedPlayers: (Player | undefined)[],
): string {
  const idx = orderedPlayers.findIndex(p => p?.playerId === playedByPlayerId);
  return idx >= 0 ? SEAT_POSITIONS[idx] : 'bottom';
}

export const GameField: React.FC<GameFieldProps> = ({
  currentField,
  players,
  onBaseSuitSelect,
  isCurrentPlayer,
  currentPlayerId,
}) => {
  const t = useTranslations('gameField');
  const isJokerBaseCard = currentField?.baseCard === 'JOKER';
  const needsBaseSuitSelection = isJokerBaseCard && !currentField?.baseSuit && isCurrentPlayer;
  const isRedBaseSuit = currentField?.baseSuit === '♥' || currentField?.baseSuit === '♦';

  const orderedPlayers = getSeatOrderWithSelfBottom(players, currentPlayerId);

  if (!currentField || currentField.cards.length === 0) {
    return null;
  }

  return (
    <div className={styles.fieldContainer}>
      <div className={styles.fieldContainerOuter}>
        <div className={styles.fieldContainerInner}>
          {currentField.cards.map((card: string, index: number) => {
            const playedByPlayerId = currentField.playedBy?.[index] ?? '';
            const position = getCardSeatPosition(playedByPlayerId, orderedPlayers);

            return (
              <div
                key={index}
                className={`${styles.playedCard} ${styles[position]}`}
                style={{ zIndex: index + 1 }}
              >
                <div className={styles.card}>
                  <CardFace card={card} />
                </div>
              </div>
            );
          })}
        </div>

        {needsBaseSuitSelection ? (
          <div className={styles.baseSuitSelection}>
            <h3>{t('selectBaseSuit')}</h3>
            <div className={styles.suitButtons}>
              <button className={styles.blackSuit} onClick={() => onBaseSuitSelect('♠')}>♠</button>
              <button className={styles.redSuit} onClick={() => onBaseSuitSelect('♥')}>♥</button>
              <button className={styles.redSuit} onClick={() => onBaseSuitSelect('♦')}>♦</button>
              <button className={styles.blackSuit} onClick={() => onBaseSuitSelect('♣')}>♣</button>
            </div>
          </div>
        ) : currentField?.baseSuit && (
          <div className={styles.baseSuitBadge} aria-label={`${t('suit')}: ${currentField.baseSuit}`}>
            <span className={styles.baseSuitBadgeLabel}>{t('suit')}</span>
            <span className={`${styles.baseSuitBadgeSymbol} ${isRedBaseSuit ? styles.redSuit : styles.blackSuit}`}>
              {currentField.baseSuit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
