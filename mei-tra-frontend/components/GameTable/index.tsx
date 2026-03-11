import React from 'react';
import { useTranslations } from 'next-intl';
import { Player, GamePhase, TrumpType, Field, CompletedField, BlowDeclaration, TeamScores, GameActions } from '../../types/game.types';
import { GameField } from '../GameField';
import { GameInfo } from '../GameInfo';
import styles from './index.module.scss';
import { PlayerHand } from '../PlayerHand';
import { GameControls } from '../GameControls';
import { BlowControls } from '../BlowControls';
import { getConsistentTableOrderWithSelfBottom } from '../../lib/utils/tableOrder';

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
  currentHighestDeclaration: BlowDeclaration | null;
  selectedTrump: TrumpType | null;
  setSelectedTrump: (trump: TrumpType | null) => void;
  numberOfPairs: number;
  setNumberOfPairs: (pairs: number) => void;
  teamScores: TeamScores;
  currentPlayerId: string | null;
  currentRoomId: string | null;
  pointsToWin: number;
  // Waiting-room props (shown before game starts)
  isWaiting?: boolean;
  isHost?: boolean;
  onStart?: () => void;
  onLeave?: () => void;
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
  currentHighestDeclaration,
  selectedTrump,
  setSelectedTrump,
  numberOfPairs,
  setNumberOfPairs,
  teamScores,
  currentPlayerId,
  currentRoomId,
  pointsToWin,
  isWaiting = false,
  isHost = false,
  onStart,
  onLeave,
}) => {
  const tRoot = useTranslations();

  if (!players || players.length === 0) {
    return null;
  }

  const currentHighestDeclarationPlayer = players.find(p => p.playerId === currentHighestDeclaration?.playerId)?.name;

  // Consistent table order for all players, self is always bottom
  const orderedPlayers = getConsistentTableOrderWithSelfBottom(players, currentPlayerId || '');
  const positions = ['bottom', 'left', 'top', 'right'];

  // During waiting, fill undefined slots with COM placeholders
  const createCOMSlot = (idx: number): Player => ({
    id: `com-${idx}`,
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
          currentRoomId={currentRoomId}
          pointsToWin={pointsToWin}
          players={players}
        />
      )}

      {gamePhase && (
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
          const currentPlayerTeam = players.find(p => p.playerId === currentPlayerId)?.team ?? 0;

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
              currentPlayerId={currentPlayerId || ''}
              players={players}
              currentField={currentField}
              currentTrump={currentTrump}
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
            isCurrentPlayer={currentPlayerId === whoseTurn}
          />
        )}
      </div>
    </>
  );
};
