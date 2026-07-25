import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Player, GamePhase, GameActions, CompletedField, Field, TrumpType, BlowDeclaration } from '@/types/game.types';
import { Card } from '@/components/game/Card';
import { CardFace } from '@/components/game/CardFace';
import { CompletedFields } from '@/components/game/CompletedFields';
import { PlayerAvatar } from '@/components/game/PlayerAvatar';
import styles from './index.module.scss';
import { useCardValidation } from './hooks/useCardValidation';
import { PlayAndCancelBtn } from '@/components/game/PlayAndCancelBtn';
import { getTrumpDisplay } from '@/lib/utils/trumpDisplay';

const HAND_CARD_METRICS = {
  width: 80,
  overlap: '-15px',
  hoverLift: 28,
  hoverOverlap: '-0.6rem',
  spreadLift: 18,
  minHeight: 160,
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
  currentHighestDeclaration?: Pick<BlowDeclaration, 'playerId'> & Partial<Pick<BlowDeclaration, 'trumpType' | 'numberOfPairs'>>;
  completedFields: CompletedField[];
  currentPlayerId: string;
  currentField: Field | null;
  currentTrump: TrumpType | null;
  isHost?: boolean;
  isIdle?: boolean;
  isDisconnected?: boolean;
  isSpectator?: boolean;
  isSpectatorPerspective?: boolean;
  onSpectatorPerspectiveChange?: (playerId: string) => void;
  onReplaceWithCOM?: (playerId: string) => void;
  takenCount?: number;
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
  currentField,
  currentTrump,
  isHost = false,
  isIdle = false,
  isDisconnected = false,
  isSpectator = false,
  isSpectatorPerspective = false,
  onSpectatorPerspectiveChange,
  onReplaceWithCOM,
  takenCount = 0,
}) => {
  const t = useTranslations('playerHand');
  const tStatus = useTranslations('playerStatus');
  const tBlow = useTranslations('blowControls');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedNegriCard, setSelectedNegriCard] = useState<string | null>(null);
  const [displayHand, setDisplayHand] = useState(player.hand);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const autoRevealAttemptedRef = useRef(false);
  const handCardMetrics = HAND_CARD_METRICS;

  const { isValidCardPlay } = useCardValidation(
    player.hand,
    currentField,
    currentTrump,
  );
  const isCurrentPlayer = currentPlayerId === player.playerId;
  const canActAsCurrentPlayer = isCurrentPlayer && !isSpectator;
  const isWinningPlayer = currentHighestDeclaration?.playerId === player.playerId;
  const playerDeclaration = isWinningPlayer && currentHighestDeclaration?.trumpType
    ? {
      trumpType: currentHighestDeclaration.trumpType,
      numberOfPairs: currentHighestDeclaration.numberOfPairs,
    }
    : null;
  const shouldSelectNegri =
    gamePhase === 'play' && canActAsCurrentPlayer && isWinningPlayer && !negriCard;
  const isNegriPlayer = Boolean(negriCard && negriPlayerId === player.playerId);
  const showAgariPanel = Boolean(isCurrentPlayer && agariCard && isWinningPlayer);
  const showDeclarationAgari = position === 'bottom' && showAgariPanel;
  const showHandStatusPanels = position === 'bottom' && shouldSelectNegri;
  const replaceWithComStatusLabel = isDisconnected
    ? tStatus('disconnected')
    : tStatus('idle');

  useEffect(() => {
    if (
      gamePhase !== 'blow' ||
      !canActAsCurrentPlayer ||
      !player.hasRequiredBroken
    ) {
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
    canActAsCurrentPlayer,
    player.hasRequiredBroken,
    player.playerId,
  ]);

  useEffect(() => {
    setDisplayHand((previousHand) => {
      const currentCards = new Set(player.hand);
      const retainedCards = previousHand.filter((card) => currentCards.has(card));
      const addedCards = player.hand.filter((card) => !retainedCards.includes(card));

      return [...retainedCards, ...addedCards];
    });
  }, [player.hand]);

  const reorderDisplayHand = (sourceCard: string, targetCard: string) => {
    if (sourceCard === targetCard) {
      return;
    }

    setDisplayHand((previousHand) => {
      const sourceIndex = previousHand.indexOf(sourceCard);
      const targetIndex = previousHand.indexOf(targetCard);
      if (sourceIndex < 0 || targetIndex < 0) {
        return previousHand;
      }

      const nextHand = [...previousHand];
      nextHand.splice(sourceIndex, 1);
      nextHand.splice(targetIndex, 0, sourceCard);
      return nextHand;
    });
  };

  const handleCardClick = (card: string) => {
    if (!canActAsCurrentPlayer) {
      return;
    }

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
            '--player-hand-card-base-width': `${handCardMetrics.width}px`,
            '--player-hand-card-base-overlap': handCardMetrics.overlap,
            '--player-hand-card-base-hover-lift': `${handCardMetrics.hoverLift}px`,
            '--player-hand-card-base-hover-overlap': handCardMetrics.hoverOverlap,
            '--player-hand-card-container-min-height': `${handCardMetrics.minHeight}px`,
          } as React.CSSProperties}
        >
          {displayHand.map((card, index) => {
            const isSelected = card === selectedCard || card === selectedNegriCard;
            const distanceFromCenter = index - (displayHand.length - 1) / 2;
            const maxDistance = Math.max((displayHand.length - 1) / 2, 1);
            const normalizedDistance = distanceFromCenter / maxDistance;
            const cardRotation = normalizedDistance * 15;
            const cardLift = Math.pow(Math.abs(normalizedDistance), 2) * handCardMetrics.spreadLift;

            const validationResult = isValidCardPlay(card);
            const isPlayable = canActAsCurrentPlayer && validationResult.isValid;

            return (
              <div
                key={index}
                className={`${styles.card} ${isSelected ? styles.selected : ''} ${isPlayable ? styles.playable : styles.unplayable} ${isSpectator ? styles.spectatorCard : ''} ${draggingCard === card ? styles.dragging : ''}`}
                draggable={canActAsCurrentPlayer}
                onClick={() => {
                  if (
                    canActAsCurrentPlayer &&
                    gamePhase === 'play' &&
                    whoseTurn === currentPlayerId &&
                    isPlayable
                  ) {
                    handleCardClick(card);
                  }
                }}
                onPointerDown={() => {
                  if (canActAsCurrentPlayer) {
                    setDraggingCard(card);
                  }
                }}
                onPointerEnter={() => {
                  if (draggingCard && canActAsCurrentPlayer) {
                    reorderDisplayHand(draggingCard, card);
                  }
                }}
                onPointerUp={() => setDraggingCard(null)}
                onPointerCancel={() => setDraggingCard(null)}
                onDragStart={(event) => {
                  if (!canActAsCurrentPlayer) {
                    event.preventDefault();
                    return;
                  }

                  event.dataTransfer.setData('text/plain', card);
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggingCard(card);
                }}
                onDragOver={(event) => {
                  if (canActAsCurrentPlayer) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceCard = event.dataTransfer.getData('text/plain') || draggingCard;
                  if (sourceCard && canActAsCurrentPlayer) {
                    reorderDisplayHand(sourceCard, card);
                  }
                  setDraggingCard(null);
                }}
                onDragEnd={() => setDraggingCard(null)}
                style={{
                  '--card-index': index,
                  '--card-total': displayHand.length,
                  '--card-rotation': `${cardRotation}deg`,
                  '--card-translate-y': `${cardLift}px`,
                } as React.CSSProperties}
              >
                <CardFace card={card} />
              </div>
            );
          })}
          {!isSpectator && selectedCard && (
            <PlayAndCancelBtn
              setSelectedCard={setSelectedCard}
              onClick={() => {
                gameActions.playCard(selectedCard);
                setSelectedCard(null);
              }}
              buttonText={t('play')}
            />
          )}
          {!isSpectator && selectedNegriCard && (
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
        {player.hand.map((card, cardIndex) => (
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

  const playerInfoContent = (
    <>
      <div className={styles.playerAvatar}>
        <PlayerAvatar
          player={player}
          size={isCurrentPlayer ? 'medium' : 'small'}
          showName={true}
        />
      </div>
      {gamePhase && <div className={styles.cardCount}>{player.hand.length}{t('cards')}</div>}
      {gamePhase === 'blow' && canActAsCurrentPlayer && player.hasBroken && (
        <button
          className={styles.brokenButton}
          onClick={() => gameActions.revealBrokenHand(player.playerId)}
        >
          {t('revealBroken')}
        </button>
      )}
    </>
  );
  const declarationBadge = playerDeclaration ? (
    <div className={styles.declarationBadge}>
      <span className={styles.declarationLabel}>{t('bid')}</span>
      <span className={styles.declarationValue}>
        <span
          aria-label={tBlow(playerDeclaration.trumpType)}
          className={styles.declarationSuit}
          data-trump={playerDeclaration.trumpType}
        >
          {getTrumpDisplay(playerDeclaration.trumpType)}
        </span>
        <span className={styles.declarationPairs}>{playerDeclaration.numberOfPairs}</span>
      </span>
    </div>
  ) : null;
  const hasBottomStatus = position === 'bottom' && Boolean(
    declarationBadge || showDeclarationAgari || showHandStatusPanels,
  );
  const bottomStatusZone = hasBottomStatus ? (
    <div className={styles.bottomStatusZone}>
      {(declarationBadge || showDeclarationAgari) && (
        <div className={styles.declarationContext}>
          {showDeclarationAgari && (
            <div className={`${styles.statusPanel} ${styles.agariStatusPanel} ${styles.declarationAgariPanel}`}>
              <div className={styles.statusHeader}>{t('agari')}</div>
              <div className={styles.statusCardFrame}>
                <Card card={agariCard!} />
              </div>
            </div>
          )}
          {declarationBadge && <div className={styles.declarationRow}>{declarationBadge}</div>}
        </div>
      )}
      {showHandStatusPanels && (
        <div className={styles.handStatusPanels}>
          <div className={styles.statusPanel}>
            <div className={styles.statusHeader}>{t('negri')}</div>
            <div className={styles.statusMessage}>{t('selectNegri')}</div>
          </div>
        </div>
      )}
    </div>
  ) : null;
  const playerMetaBadges = (
    <div className={styles.playerMetaBadges}>
      {takenCount > 0 && (
        <span
          className={styles.takenBadge}
          aria-label={`${takenCount}${t('setsTaken')}`}
          title={`${takenCount}${t('setsTaken')}`}
        >
          <span aria-hidden="true">🂠</span>
          <strong>{takenCount}</strong>
        </span>
      )}
      {isNegriPlayer && <span className={styles.negriBadge}>{t('negri')}</span>}
      {isCurrentTurn && (
        <span
          className={styles.turnBadge}
          role="img"
          aria-label={t('currentTurn')}
          title={t('currentTurn')}
        >
          ◷
        </span>
      )}
    </div>
  );

  return (
    <div className={`${styles.playerPosition} ${styles[position]}`}>
      <div className={`${styles.playerInfo} ${hasBottomStatus ? styles.hasBottomStatus : ''}`}>
        {position === 'bottom' ? bottomStatusZone : declarationBadge}
        <div className={styles.playerInfoGroup}>
          {isSpectator ? (
            <button
              type="button"
              className={`${styles.playerInfoContainer} ${styles.spectatorPerspectiveButton} ${isCurrentTurn ? styles.currentTurn : ''} ${isSpectatorPerspective ? styles.spectatorPerspective : ''}`}
              onClick={() => onSpectatorPerspectiveChange?.(player.playerId)}
              aria-pressed={isSpectatorPerspective}
              aria-label={`Switch spectator perspective to ${player.name}`}
            >
              {playerInfoContent}
              {playerMetaBadges}
            </button>
          ) : (
            <div className={`${styles.playerInfoContainer} ${isCurrentTurn ? styles.currentTurn : ''}`}>
              {playerInfoContent}
              {playerMetaBadges}
            </div>
          )}
          {shouldSelectNegri && !showHandStatusPanels && (
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
                <div className={styles.statusHeader}>{replaceWithComStatusLabel}</div>
                <button
                  type="button"
                  className={styles.replaceWithComButton}
                  onClick={() => onReplaceWithCOM(player.playerId)}
                >
                  {tStatus('replaceWithCom')}
                </button>
              </div>
            )}
          {showAgariPanel && position !== 'bottom' && (
            <div className={`${styles.statusPanel} ${styles.agariStatusPanel}`}>
              <div className={styles.statusHeader}>{t('agari')}</div>
              <div className={styles.statusCardFrame}>
                <Card card={agariCard!} />
              </div>
            </div>
          )}
        </div>
        {renderPlayerHand(isCurrentPlayer)}
        {(completedFields.length > 0 || (position === 'bottom' && gamePhase === 'play')) && (
          <div className={styles.completedFields}>
            <CompletedFields
              fields={completedFields}
            />
          </div>
        )}
      </div>
    </div>
  );
};
