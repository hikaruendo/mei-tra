import React from 'react';
import { Player, GamePhase, TrumpType, Field, CompletedField, BlowDeclaration, TeamScores, GameActions } from '../../types/game.types';
import { GameField } from '../GameField';
import { GameInfo } from '../GameInfo';
import styles from './index.module.scss';
import { PlayerHand } from '../PlayerHand';
import { GameControls } from '../GameControls';
import { BlowControls } from '../BlowControls';

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
}

// Utility: Get consistent table order (Team0, Team1, Team0, Team1), rotated so self is bottom
function getConsistentTableOrderWithSelfBottom(players: Player[], currentPlayerId: string): Player[] {
  // If we don't have enough players, return an array with undefined for missing positions
  if (players.length < 4) {
    const result: (Player | undefined)[] = new Array(4).fill(undefined);
    // Fill in the positions we have players for
    players.forEach((player, index) => {
      result[index] = player;
    });
    return result as Player[];
  }

  const team0 = players.filter(p => p.team === 0);
  const team1 = players.filter(p => p.team === 1);
  const order: Player[] = [];
  for (let i = 0; i < 2; i++) {
    if (team0[i]) order.push(team0[i]);
    if (team1[i]) order.push(team1[i]);
  }
  // 自分が先頭（bottom）になるように回転
  const selfIdx = order.findIndex(p => p.playerId === currentPlayerId);
  if (selfIdx > 0) {
    // 反時計回りになるように順序を反転
    const rotated = [...order.slice(selfIdx), ...order.slice(0, selfIdx)];
    return [rotated[0], rotated[3], rotated[2], rotated[1]];
  }
  return [order[0], order[3], order[2], order[1]];
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
}) => {
  // Add null check for players array
  if (!players || players.length === 0) {
    return null;
  }

  const currentHighestDeclarationPlayer = players.find(p => p.playerId === currentHighestDeclaration?.playerId)?.name;

  // Consistent table order for all players, self is always bottom
  const orderedPlayers = getConsistentTableOrderWithSelfBottom(players, currentPlayerId || '');
  const positions = ['bottom', 'left', 'top', 'right'];

  return (
    <>
      <GameInfo
        currentTrump={currentTrump}
        currentHighestDeclarationPlayer={currentHighestDeclarationPlayer ?? null}
        numberOfPairs={currentHighestDeclaration?.numberOfPairs ?? 0}
        teamScores={teamScores}
        currentRoomId={currentRoomId}
        pointsToWin={pointsToWin}
      />

      {gamePhase && (
        <GameControls 
          gamePhase={gamePhase}
          renderBlowControls={() => (
            <BlowControls
              isCurrentPlayer={currentPlayerId === whoseTurn}
              currentPlayer={players.find(p => p.playerId === currentPlayerId)}
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
          if (!player) return null;  // Skip if player is undefined
          
          const position = positions[idx];
          const currentPlayerTeam = players.find(p => p.playerId === currentPlayerId)?.team ?? 0;

          // Show all team's completed fields only for bottom player
          const teamCompletedFields = position === 'bottom' 
            ? completedFields.filter(field => field.winnerTeam === currentPlayerTeam)
            : [];

          return (
            <PlayerHand
              key={player.playerId}
              player={player}
              isCurrentTurn={whoseTurn === player.playerId}
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
          )
        })}

        {/* Center field */}
        <GameField
          currentField={currentField}
          players={players}
          onBaseSuitSelect={gameActions.selectBaseSuit}
          isCurrentPlayer={currentPlayerId === whoseTurn}
        />
      </div>
    </>
  );
}; 