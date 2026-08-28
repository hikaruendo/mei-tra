import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Player, GamePhase, TrumpType, Field, CompletedField, BlowAction, BlowDeclaration, TeamScores, GameActions, TeamNames, FirstTurnReveal } from '@/types/game.types';
import { GameField } from '@/components/game/GameField';
import { GameInfo } from '@/components/game/GameInfo';
import { GameDock } from '@/components/game/GameDock';
import styles from './index.module.scss';
import { PlayerHand } from '@/components/game/PlayerHand';
import { GameControls } from '@/components/game/GameControls';
import { BlowControls } from '@/components/game/BlowControls';
import { BlowSpectatorPanel } from '@/components/game/BlowSpectatorPanel';
import { getSeatOrderWithSelfBottom, type SeatPosition } from '@/lib/utils/tableOrder';
import { usePreloadCards } from '@/hooks/usePreloadCards';
import { StartPlayerJanken, type RevealSeat } from '@/components/game/StartPlayerJanken';
import { useFirstTurnReveal } from '@/components/game/StartPlayerJanken/useFirstTurnReveal';
import { asSeatId } from '@contracts/ids';
import type { DealAnimationCue } from '@meitra/game-client/deal-animation';

interface GameTableProps {
  whoseTurn: string | null;
  gamePhase: GamePhase | null;
  currentTrump: TrumpType | null;
  currentField: Field | null;
  players: Player[];
  negriCard: string | null;
  completedFields: CompletedField[];
  revealedAgari: string | null;
  gameActions: GameActions;
  blowDeclarations: BlowDeclaration[];
  blowActionHistory: BlowAction[];
  currentHighestDeclaration: BlowDeclaration | null;
  selectedTrump: TrumpType | null;
  setSelectedTrump: (trump: TrumpType | null) => void;
  numberOfPairs: number;
  setNumberOfPairs: (pairs: number) => void;
  teamScores: TeamScores;
  currentSeatId: string | null;
  currentRoomId: string | null;
  idleSeatIds?: string[];
  disconnectedSeatIds?: string[];
  pointsToWin: number;
  teamNames?: TeamNames;
  // Waiting-room props (shown before game starts)
  isWaiting?: boolean;
  isHost?: boolean;
  isSpectator?: boolean;
  onStart?: () => void;
  onLeave?: () => void;
  onReplaceWithCOM?: (seatId: string) => void;
  firstTurnReveal?: FirstTurnReveal | null;
  onFirstTurnRevealDone?: () => void;
  dealAnimationCue?: DealAnimationCue | null;
  onCardSelection?: () => void;
  onHandReorder?: () => void;
}


const noop = () => {};

export const GameTable: React.FC<GameTableProps> = ({
  whoseTurn,
  gamePhase,
  currentTrump,
  currentField,
  players,
  negriCard,
  completedFields,
  revealedAgari,
  gameActions,
  blowDeclarations,
  blowActionHistory,
  currentHighestDeclaration,
  selectedTrump,
  setSelectedTrump,
  numberOfPairs,
  setNumberOfPairs,
  teamScores,
  currentSeatId,
  currentRoomId,
  pointsToWin,
  teamNames,
  idleSeatIds = [],
  disconnectedSeatIds = [],
  isWaiting = false,
  isHost = false,
  isSpectator = false,
  onStart,
  onLeave,
  onReplaceWithCOM,
  firstTurnReveal = null,
  onFirstTurnRevealDone,
  dealAnimationCue = null,
  onCardSelection = noop,
  onHandReorder = noop,
}) => {
  const tRoot = useTranslations();
  usePreloadCards();
  const [spectatorPerspectiveSeatId, setSpectatorPerspectiveSeatId] =
    useState<string | null>(null);

  const hostSeatId = players.find((player) => player.isHost)?.seatId ?? players[0]?.seatId ?? null;
  const tablePerspectiveSeatId = isSpectator
    ? spectatorPerspectiveSeatId ?? hostSeatId
    : currentSeatId;
  const perspectivePlayerTeam = players.find(
    (player) => player.seatId === tablePerspectiveSeatId,
  )?.team ?? 0;

  useEffect(() => {
    if (!isSpectator) {
      if (spectatorPerspectiveSeatId) {
        setSpectatorPerspectiveSeatId(null);
      }
      return;
    }

    const hasSelectedPerspective = players.some(
      (player) => player.seatId === spectatorPerspectiveSeatId,
    );
    if (!hasSelectedPerspective) {
      setSpectatorPerspectiveSeatId(hostSeatId);
    }
  }, [hostSeatId, isSpectator, players, spectatorPerspectiveSeatId]);

  // Consistent table order for all players, self is always bottom
  const orderedPlayers = getSeatOrderWithSelfBottom(
    players,
    tablePerspectiveSeatId || '',
  );
  const positions: SeatPosition[] = ['bottom', 'left', 'top', 'right'];

  const revealSeats: RevealSeat[] = orderedPlayers.flatMap((player) =>
    player ? [{ seatId: player.seatId, name: player.name }] : [],
  );
  // Without the completion callback the reveal could never report itself done
  // and the overlay would stay up forever, so it only arms when both arrive.
  const armedReveal = onFirstTurnRevealDone ? firstTurnReveal : null;
  const { step: revealStep, highlightSeatId } = useFirstTurnReveal({
    reveal: armedReveal,
    seatIds: revealSeats.map((seat) => seat.seatId),
    onDone: onFirstTurnRevealDone ?? noop,
  });

  if (!players || players.length === 0) {
    return null;
  }

  // During waiting, fill undefined slots with COM placeholders
  const createCOMSlot = (idx: number): Player => ({
    socketId: `com-${idx}`,
    seatId: asSeatId(`com-${idx}`),
    name: 'COM',
    team: (idx % 2) as Player['team'],
    hand: [],
    isCOM: true,
  });

  return (
    <div className={styles.gameTable}>
      {!isWaiting && (
        <GameInfo
          teamScores={teamScores}
          pointsToWin={pointsToWin}
          teamNames={teamNames}
          actionSlot={
            currentRoomId ? (onLeaveRequest) => (
              <GameDock
                roomId={currentRoomId}
                gameStarted={!isWaiting}
                currentTrump={currentTrump}
                gamePhase={gamePhase}
                players={players}
                teamNames={teamNames}
                onLeaveRequest={onLeaveRequest}
              />
            ) : undefined
          }
          onLeave={onLeave}
        />
      )}

      {/* The fixed blow panel sits above the table; hold it back while the
          reveal plays so the animation is not covered. */}
      {gamePhase && !revealStep && (
        <GameControls
          gamePhase={gamePhase}
          renderBlowControls={() => {
            if (isSpectator) {
              return (
                <BlowSpectatorPanel
                  whoseTurn={whoseTurn}
                  blowDeclarations={blowDeclarations}
                  blowActionHistory={blowActionHistory}
                  currentHighestDeclaration={currentHighestDeclaration}
                  players={players}
                />
              );
            }

            return (
              <BlowControls
                isCurrentPlayer={currentSeatId === whoseTurn}
                whoseTurn={whoseTurn}
                selectedTrump={selectedTrump}
                setSelectedTrump={setSelectedTrump}
                numberOfPairs={numberOfPairs}
                setNumberOfPairs={setNumberOfPairs}
                declareBlow={gameActions.declareBlow}
                passBlow={gameActions.passBlow}
                blowDeclarations={blowDeclarations}
                blowActionHistory={blowActionHistory}
                currentHighestDeclaration={currentHighestDeclaration}
                players={players}
              />
            );
          }}
        />
      )}

      <div className={styles.playerPositions}>
        {orderedPlayers.map((player, idx) => {
          const resolvedPlayer = player ?? (isWaiting ? createCOMSlot(idx) : null);
          if (!resolvedPlayer) return null;
          const player_ = resolvedPlayer;

          const position = positions[idx];
          const currentPlayerTeam = isSpectator
            ? perspectivePlayerTeam
            : players.find(p => p.seatId === currentSeatId)?.team ?? 0;

          // Show all team's completed fields only for bottom player
          const teamCompletedFields = position === 'bottom'
            ? completedFields.filter(field => field.winnerTeam === currentPlayerTeam)
            : [];
          const takenCount = completedFields.filter(
            (field) => field.winnerTeam === player_.team,
          ).length;

          return (
            <PlayerHand
              key={player_.seatId}
              player={player_}
              isCurrentTurn={
                whoseTurn === player_.seatId ||
                highlightSeatId === player_.seatId
              }
              negriCard={negriCard}
              gamePhase={gamePhase}
              whoseTurn={whoseTurn}
              gameActions={gameActions}
              position={positions[idx]}
              agariCard={revealedAgari || undefined}
              currentHighestDeclaration={currentHighestDeclaration || undefined}
              completedFields={teamCompletedFields}
              currentSeatId={tablePerspectiveSeatId || ''}
              currentField={currentField}
              currentTrump={currentTrump}
              takenCount={takenCount}
              teamNames={teamNames}
              isHost={isHost}
              isIdle={idleSeatIds.includes(player_.seatId)}
              isDisconnected={disconnectedSeatIds.includes(player_.seatId)}
              isSpectator={isSpectator}
              isSpectatorPerspective={
                isSpectator && tablePerspectiveSeatId === player_.seatId
              }
              onSpectatorPerspectiveChange={
                isSpectator ? setSpectatorPerspectiveSeatId : undefined
              }
              onReplaceWithCOM={onReplaceWithCOM}
              dealAnimationCue={dealAnimationCue}
              onCardSelection={onCardSelection}
              onHandReorder={onHandReorder}
            />
          );
        })}

        {isWaiting ? (
          // Waiting room: show Start/Leave controls in the center field area
          <div className={styles.waitingCenter}>
            {isHost ? (
              <button className={styles.startButton} onClick={onStart}>
                {tRoot('room.start')}
              </button>
            ) : (
              <p className={styles.waitingText}>{tRoot('room.waitingForHost')}</p>
            )}
            <button className={styles.leaveButton} onClick={onLeave}>
              {tRoot('common.leave')}
            </button>
          </div>
        ) : (
          <GameField
            currentField={currentField}
            players={players}
            onBaseSuitSelect={gameActions.selectBaseSuit}
            isCurrentPlayer={!isSpectator && currentSeatId === whoseTurn}
            currentSeatId={tablePerspectiveSeatId || ''}
          />
        )}

        {revealStep && armedReveal && (
          <StartPlayerJanken
            step={revealStep}
            seats={revealSeats}
            lastBlowSeatId={armedReveal.lastBlowSeatId}
          />
        )}
      </div>
    </div>
  );
};
