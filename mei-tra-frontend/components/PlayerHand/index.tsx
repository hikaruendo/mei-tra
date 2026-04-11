import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Player, GamePhase, GameActions, CompletedField, Field, TrumpType } from '../../types/game.types';
import { FontSizePreset } from '../../types/user.types';
import { NegriCard } from '../NegriCard';
import { Card } from '../Card';
import { CardFace } from '../CardFace';
import { CompletedFields } from '../CompletedFields';
import { PlayerAvatar } from '../PlayerAvatar';
import { useAuth } from '../../hooks/useAuth';
import styles from './index.module.scss';
import { useCardValidation } from './hooks/useCardValidation';
import { PlayAndCancelBtn } from '../PlayAndCancelBtn';

const HAND_CARD_METRICS: Record<
  FontSizePreset,
  {
    width: number;
    overlap: string;
    hoverLift: number;
    hoverOverlap: string;
    spreadLift: number;
    minHeight: number;
  }
> = {
  standard: {
    width: 72,
    overlap: '-15px',
    hoverLift: 28,
    hoverOverlap: '-0.6rem',
    spreadLift: 18,
    minHeight: 160,
  },
  large: {
    width: 80,
    overlap: '-18px',
    hoverLift: 32,
    hoverOverlap: '-0.72rem',
    spreadLift: 20,
    minHeight: 168,
  },
  xlarge: {
    width: 88,
    overlap: '-21px',
    hoverLift: 36,
    hoverOverlap: '-0.85rem',
    spreadLift: 23,
    minHeight: 178,
  },
  xxlarge: {
    width: 96,
    overlap: '-24px',
    hoverLift: 40,
    hoverOverlap: '-1rem',
    spreadLift: 26,
    minHeight: 188,
  },
};

interface PlayerHandProps {
  player: Player;
  isCurrentTurn: boolean;
  negriCard: string | null;
  negriPlayerId: string | null;
  gamePhase: GamePhase | null;
  whoseTurn: string | null;
  gameActions: GameActions;
  position: string;
  agariCard?: string;
  currentHighestDeclaration?: { playerId: string };
  completedFields: CompletedField[];
  currentPlayerId: string;
  players: Player[];
  currentField: Field | null;
  currentTrump: TrumpType | null;
  isHost?: boolean;
  isIdle?: boolean;
  onReplaceWithCOM?: (playerId: string) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  player,
  isCurrentTurn,
  negriCard,
  negriPlayerId,
  gamePhase,
  whoseTurn,
  gameActions,
  position,
  agariCard,
  currentHighestDeclaration,
  completedFields,
  currentPlayerId,
  players,
  currentField,
  currentTrump,
  isHost = false,
  isIdle = false,
  onReplaceWithCOM,
}) => {
  const t = useTranslations('playerHand');
  const tStatus = useTranslations('playerStatus');
  const { fontSizePreference } = useAuth();
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedNegriCard, setSelectedNegriCard] = useState<string | null>(null);
  const autoRevealAttemptedRef = useRef(false);
  const handCardMetrics = HAND_CARD_METRICS[fontSizePreference];

  const { isValidCardPlay } = useCardValidation(
    player.hand,
    currentField,
    currentTrump,
  );
  const isCurrentPlayer = currentPlayerId === player.playerId;
  const isWinningPlayer = currentHighestDeclaration?.playerId === player.playerId;
  const isDisconnected = !player.isCOM && !player.socketId;

  useEffect(() => {
    if (gamePhase !== 'blow' || !isCurrentPlayer || !player.hasRequiredBroken) {
      autoRevealAttemptedRef.current = false;
      return;
    }

    if (autoRevealAttemptedRef.current) {
      return;
    }

    autoRevealAttemptedRef.current = true;
    gameActions.revealBrokenHand(player.playerId);
  }, [
    gamePhase,
    gameActions,
    isCurrentPlayer,
    player.hasRequiredBroken,
    player.playerId,
  ]);

  const handleCardClick = (card: string) => {
    if (gamePhase === 'play' && whoseTurn === currentPlayerId) {
      if (!negriCard && currentHighestDeclaration?.playerId === player.playerId) {
        setSelectedNegriCard(card);
      } else {
        setSelectedCard(card);
      }
    }
  };

  const renderPlayerHand = (isCurrentPlayer: boolean) => {
    if (isCurrentPlayer) {
      return (
        <div
          className={styles.handContainer}
          style={{
            '--player-hand-card-width': `${handCardMetrics.width}px`,
            '--player-hand-card-overlap': handCardMetrics.overlap,
            '--player-hand-card-hover-lift': `${handCardMetrics.hoverLift}px`,
            '--player-hand-card-hover-overlap': handCardMetrics.hoverOverlap,
            '--player-hand-card-container-min-height': `${handCardMetrics.minHeight}px`,
          } as React.CSSProperties}
        >
          {player.hand.map((card, index) => {
            const isNegri = card === negriCard;
            const isSelected = card === selectedCard || card === selectedNegriCard;
            const distanceFromCenter = index - (player.hand.length - 1) / 2;
            const maxDistance = Math.max((player.hand.length - 1) / 2, 1);
            const normalizedDistance = distanceFromCenter / maxDistance;
            const cardRotation = normalizedDistance * 15;
            const cardLift = Math.pow(Math.abs(normalizedDistance), 2) * handCardMetrics.spreadLift;

            const validationResult = isValidCardPlay(card);
            const isPlayable = isCurrentPlayer && validationResult.isValid;

            return (
              <div
                key={index}
                className={`${styles.card} ${isNegri ? styles.negriCard : ''} ${isSelected ? styles.selected : ''} ${isPlayable ? styles.playable : styles.unplayable}`}
                onClick={() => {
                  if (gamePhase === 'play' && whoseTurn === currentPlayerId && isPlayable) {
                    handleCardClick(card);
                  }
                }}
                style={{
                  '--card-index': index,
                  '--card-total': player.hand.length,
                  '--card-rotation': `${cardRotation}deg`,
                  '--card-translate-y': `${cardLift}px`,
                } as React.CSSProperties}
              >
                <CardFace card={card} />
                {isNegri && <div className={styles.negriLabel}>{t('negri')}</div>}
              </div>
            );
          })}
          {selectedCard && (
            <PlayAndCancelBtn
              setSelectedCard={setSelectedCard}
              onClick={() => {
                gameActions.playCard(selectedCard);
                setSelectedCard(null);
              }}
              buttonText={t('play')}
            />
          )}
          {selectedNegriCard && (
            <PlayAndCancelBtn
              setSelectedCard={setSelectedNegriCard}
              onClick={() => {
                gameActions.selectNegri(selectedNegriCard);
                setSelectedNegriCard(null);
              }}
              buttonText={t('negri')}
            />
          )}
        </div>
      );
    }

    return (
      <div className={styles.otherPlayerHandContainer}>
        {Array(player.hand.length).fill(null).map((_, cardIndex) => (
          <div
            key={cardIndex}
            className={styles.cardFaceDown}
            style={{
              '--card-index': cardIndex,
              '--card-total': player.hand.length,
            } as React.CSSProperties}
          >
            <CardFace faceDown />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`${styles.playerPosition} ${styles[position]}`}>
      <div className={styles.playerInfo}>
        <div className={styles.playerInfoGroup}>
          <div className={`${styles.playerInfoContainer} ${isCurrentTurn ? styles.currentTurn : ''}`}>
            <div className={styles.playerAvatar}>
              <PlayerAvatar
                player={player}
                size="medium"
                showName={true}
              />
            </div>
            {gamePhase && <div className={styles.cardCount}>{player.hand.length}{t('cards')}</div>}
            {gamePhase === 'blow' && isCurrentPlayer && player.hasBroken && (
              <button
                className={styles.brokenButton}
                onClick={() => gameActions.revealBrokenHand(player.playerId)}
              >
                {t('revealBroken')}
              </button>
            )}
          </div>
          {negriCard && negriPlayerId === player.playerId && (
            <NegriCard
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
              currentPlayerId={currentPlayerId}
            />
          )}
          {gamePhase === 'play' && isCurrentPlayer && isWinningPlayer && !negriCard && (
            <div className={styles.statusPanel}>
              <div className={styles.statusHeader}>{t('negri')}</div>
              <div className={styles.statusMessage}>{t('selectNegri')}</div>
            </div>
          )}
          {isHost &&
            onReplaceWithCOM &&
            !isCurrentPlayer &&
            (isDisconnected || isIdle) &&
            !player.isCOM && (
              <div className={`${styles.statusPanel} ${styles.replaceWithComPanel}`}>
                <div className={styles.statusHeader}>{tStatus('disconnected')}</div>
                <button
                  type="button"
                  className={styles.replaceWithComButton}
                  onClick={() => onReplaceWithCOM(player.playerId)}
                >
                  {tStatus('replaceWithCom')}
                </button>
              </div>
            )}
          {isCurrentPlayer && agariCard && isWinningPlayer && (
            <div className={`${styles.statusPanel} ${styles.agariStatusPanel}`}>
              <div className={styles.statusHeader}>{t('agari')}</div>
              <div className={styles.statusCardFrame}>
                <Card card={agariCard} />
              </div>
            </div>
          )}
        </div>
        {renderPlayerHand(isCurrentPlayer)}
        {completedFields.length > 0 && (
          <CompletedFields
            fields={completedFields}
            players={players}
          />
        )}
      </div>
    </div>
  );
};
