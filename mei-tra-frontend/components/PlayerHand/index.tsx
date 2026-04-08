import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Player, GamePhase, GameActions, CompletedField, Field, TrumpType } from '../../types/game.types';
import { NegriCard } from '../NegriCard';
import { Card } from '../Card';
import { CompletedFields } from '../CompletedFields';
import { PlayerAvatar } from '../PlayerAvatar';
import styles from './index.module.scss';
import { useCardValidation } from './hooks/useCardValidation';
import { PlayAndCancelBtn } from '../PlayAndCancelBtn';

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
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedNegriCard, setSelectedNegriCard] = useState<string | null>(null);
  const autoRevealAttemptedRef = useRef(false);

  const { isValidCardPlay } = useCardValidation(
    player.hand,
    currentField,
    currentTrump,
  );
  const isCurrentPlayer = currentPlayerId === player.playerId;
  const isWinningPlayer = currentHighestDeclaration?.playerId === player.playerId;
  const isDisconnected = !player.isCOM && !player.id;
  const statusLabel = isDisconnected
    ? tStatus('disconnected')
    : isIdle
      ? tStatus('idle')
      : null;

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
        <div className={styles.handContainer}>
          {player.hand.map((card, index) => {
            const value = card.replace(/[♠♣♥♦]/, '');
            const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
            const isRed = suit === '♥' || suit === '♦';
            const isNegri = card === negriCard;
            const isJoker = card === 'JOKER';
            const isSelected = card === selectedCard || card === selectedNegriCard;
            const distanceFromCenter = index - (player.hand.length - 1) / 2;
            const maxDistance = Math.max((player.hand.length - 1) / 2, 1);
            const normalizedDistance = distanceFromCenter / maxDistance;
            const cardRotation = normalizedDistance * 15;
            const cardLift = Math.pow(Math.abs(normalizedDistance), 2) * 18;

            const validationResult = isValidCardPlay(card);
            const isPlayable = isCurrentPlayer && validationResult.isValid;

            return (
              <div
                key={index}
                className={`${styles.card} ${isRed || isNegri ? styles.redSuit : styles.blackSuit} ${isNegri ? styles.negriCard : ''} ${isJoker ? styles.joker : ''} ${isSelected ? styles.selected : ''} ${isPlayable ? styles.playable : styles.unplayable}`}
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
                {isJoker ? (
                  <div className={styles.jokerRank}>JOKER</div>
                ) : (
                  <>
                    <div className={styles.rank}>{value}</div>
                    <div className={styles.suit}>{suit}</div>
                  </>
                )}
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
            🂠
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
                statusLabel={statusLabel}
              />
            </div>
            {gamePhase && <div className={styles.cardCount}>{player.hand.length}{t('cards')}</div>}
            {statusLabel && (
              <div className={styles.disconnectedBadge}>{statusLabel}</div>
            )}
            {isHost &&
              onReplaceWithCOM &&
              !isCurrentPlayer &&
              (isDisconnected || isIdle) &&
              !player.isCOM && (
                <button
                  type="button"
                  className={styles.replaceWithComButton}
                  onClick={() => onReplaceWithCOM(player.playerId)}
                >
                  {tStatus('replaceWithCom')}
                </button>
              )}
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
