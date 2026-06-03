import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Player, GamePhase, TrumpType, Field, CompletedField, BlowAction, BlowDeclaration, TeamScores, GameActions } from '@/types/game.types';
import { GameField } from '@/components/game/GameField';
import { GameInfo } from '@/components/game/GameInfo';
import { GameDock } from '@/components/game/GameDock';
import styles from './index.module.scss';
import { PlayerHand } from '@/components/game/PlayerHand';
import { GameControls } from '@/components/game/GameControls';
import { BlowControls } from '@/components/game/BlowControls';
import { getSeatOrderWithSelfBottom } from '@/lib/utils/tableOrder';
import { usePreloadCards } from '@/hooks/usePreloadCards';

interface GameTableProps {
  whoseTurn: string | null;
  gamePhase: GamePhase | null;
  currentTrump: TrumpType | null;
  currentField: Field | null;
  players: Player[];
  negriCard: string | null;
  negriPlayerId: string | null;
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
  currentPlayerId: string | null;
  currentRoomId: string | null;
  idlePlayerIds?: string[];
  disconnectedPlayerIds?: string[];
  pointsToWin: number;
  // Waiting-room props (shown before game starts)
  isWaiting?: boolean;
  isHost?: boolean;
  isSpectator?: boolean;
  onStart?: () => void;
  onLeave?: () => void;
  onReplaceWithCOM?: (playerId: string) => void;
}


export const GameTable: React.FC<GameTableProps> = ({
  whoseTurn,
  gamePhase,
  currentTrump,
  currentField,
  players,
  negriCard,
  negriPlayerId,
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
  currentPlayerId,
  currentRoomId,
  pointsToWin,
  idlePlayerIds = [],
  disconnectedPlayerIds = [],
  isWaiting = false,
  isHost = false,
  isSpectator = false,
  onStart,
  onLeave,
  onReplaceWithCOM,
}) => {
  const tRoot = useTranslations();
  usePreloadCards();
  const [spectatorPerspectivePlayerId, setSpectatorPerspectivePlayerId] =
    useState<string | null>(null);

  const currentHighestDeclarationPlayer = players.find(p => p.playerId === currentHighestDeclaration?.playerId)?.name;
  const hostPlayerId = players.find((player) => player.isHost)?.playerId ?? players[0]?.playerId ?? null;
  const tablePerspectivePlayerId = isSpectator
    ? spectatorPerspectivePlayerId ?? hostPlayerId
    : currentPlayerId;
  const perspectivePlayerTeam = players.find(
    (player) => player.playerId === tablePerspectivePlayerId,
  )?.team ?? 0;

  useEffect(() => {
    if (!isSpectator) {
      if (spectatorPerspectivePlayerId) {
        setSpectatorPerspectivePlayerId(null);
      }
      return;
    }

    const hasSelectedPerspective = players.some(
      (player) => player.playerId === spectatorPerspectivePlayerId,
    );
    if (!hasSelectedPerspective) {
      setSpectatorPerspectivePlayerId(hostPlayerId);
    }
  }, [hostPlayerId, isSpectator, players, spectatorPerspectivePlayerId]);

  if (!players || players.length === 0) {
    return null;
  }

  // Consistent table order for all players, self is always bottom
  const orderedPlayers = getSeatOrderWithSelfBottom(
    players,
    tablePerspectivePlayerId || '',
  );
  const positions = ['bottom', 'left', 'top', 'right'];

  // During waiting, fill undefined slots with COM placeholders
  const createCOMSlot = (idx: number): Player => ({
    socketId: `com-${idx}`,
    playerId: `com-${idx}`,
    name: 'COM',
    team: (idx % 2) as Player['team'],
    hand: [],
    isCOM: true,
  });

  return (
    <>
      {!isWaiting && (
        <GameInfo
          currentTrump={currentTrump}
          currentHighestDeclarationPlayer={currentHighestDeclarationPlayer ?? null}
          numberOfPairs={currentHighestDeclaration?.numberOfPairs ?? 0}
          teamScores={teamScores}
          pointsToWin={pointsToWin}
          players={players}
          actionSlot={
            currentRoomId ? (
              <GameDock
                roomId={currentRoomId}
                gameStarted={!isWaiting}
                currentTrump={currentTrump}
                gamePhase={gamePhase}
              />
            ) : null
          }
          onLeave={onLeave}
        />
      )}

      {gamePhase && !isSpectator && (
        <GameControls
          gamePhase={gamePhase}
          renderBlowControls={() => (
            <BlowControls
              isCurrentPlayer={currentPlayerId === whoseTurn}
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
          )}
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
            : players.find(p => p.playerId === currentPlayerId)?.team ?? 0;

          // Show all team's completed fields only for bottom player
          const teamCompletedFields = position === 'bottom'
            ? completedFields.filter(field => field.winnerTeam === currentPlayerTeam)
            : [];

          return (
            <PlayerHand
              key={player_.playerId}
              player={player_}
              isCurrentTurn={whoseTurn === player_.playerId}
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
              gamePhase={gamePhase}
              whoseTurn={whoseTurn}
              gameActions={gameActions}
              position={positions[idx]}
              agariCard={revealedAgari || undefined}
              currentHighestDeclaration={currentHighestDeclaration || undefined}
              completedFields={teamCompletedFields}
              currentPlayerId={tablePerspectivePlayerId || ''}
              players={players}
              currentField={currentField}
              currentTrump={currentTrump}
              isHost={isHost}
              isIdle={idlePlayerIds.includes(player_.playerId)}
              isDisconnected={disconnectedPlayerIds.includes(player_.playerId)}
              isSpectator={isSpectator}
              isSpectatorPerspective={
                isSpectator && tablePerspectivePlayerId === player_.playerId
              }
              onSpectatorPerspectiveChange={
                isSpectator ? setSpectatorPerspectivePlayerId : undefined
              }
              onReplaceWithCOM={onReplaceWithCOM}
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
            isCurrentPlayer={!isSpectator && currentPlayerId === whoseTurn}
            currentPlayerId={tablePerspectivePlayerId || ''}
          />
        )}
      </div>
    </>
  );
};
