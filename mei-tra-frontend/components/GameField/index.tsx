import React from 'react';
import { useTranslations } from 'next-intl';
import { Player, Field } from '../../types/game.types';
import { PlayerIdentityChip } from '../PlayerIdentityChip';
import { CardFace } from '../CardFace';
import styles from './index.module.scss';

interface GameFieldProps {
  currentField: Field | null;
  players: Player[];
  onBaseSuitSelect: (suit: string) => void;
  isCurrentPlayer: boolean;
}

export const GameField: React.FC<GameFieldProps> = ({
  currentField,
  players,
  onBaseSuitSelect,
  isCurrentPlayer,
}) => {
  const t = useTranslations('gameField');
  const isJokerBaseCard = currentField?.baseCard === 'JOKER';
  // If it's a Joker, base suit selection is needed
  const needsBaseSuitSelection = isJokerBaseCard && !currentField?.baseSuit && isCurrentPlayer;

  if (!currentField || currentField.cards.length === 0) {
    return null;
  }

  return (
    <div className={styles.fieldContainer}>
      {currentField && (
        <div className={styles.fieldContainerOuter}>
          <div className={styles.fieldContainerInner}>
            {currentField.cards.map((card: string, index: number) => {
              const playedByPlayerId = currentField.playedBy?.[index];
              const player = playedByPlayerId
                ? players.find((candidate) => candidate.playerId === playedByPlayerId) ?? null
                : null;

              return (
                <div key={index} className={styles.fieldContent}>
                  {player ? (
                    <PlayerIdentityChip
                      name={player.name}
                      team={player.team}
                      size="compact"
                      className={styles.name}
                    />
                  ) : (
                    <div className={styles.nameFallback}>{t('unknown')}</div>
                  )}
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
                <button onClick={() => onBaseSuitSelect('♠')}>♠</button>
                <button onClick={() => onBaseSuitSelect('♥')}>♥</button>
                <button onClick={() => onBaseSuitSelect('♦')}>♦</button>
                <button onClick={() => onBaseSuitSelect('♣')}>♣</button>
              </div>
            </div>
          ) : currentField?.baseSuit && (
            <div className={styles.baseSuitSelection}>
              <h3>{t('suit')}</h3>
              <div className={styles.suitButtons}>
                <button disabled className={`${styles.selectedSuit} ${currentField.baseSuit === '♠' ? styles.blackSuit : ''} ${currentField.baseSuit === '♥' || currentField.baseSuit === '♦' ? styles.redSuit : ''} ${currentField.baseSuit === '♣' ? styles.blackSuit : ''}`}>
                  {currentField.baseSuit}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 
