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
}) => {
  const getRelativePosition = (player: Player) => {
    if (!currentPlayerId) return 'bottom';
    
    const currentIndex = players.findIndex(p => p.playerId === currentPlayerId);
    const playerIndex = players.findIndex(p => p.playerId === player.playerId);

    if (player.playerId === currentPlayerId) return 'bottom';

    const currentTeam = players.find(p => p.playerId === currentPlayerId)?.team;
    const isTeammate = player.team === currentTeam;

    if (isTeammate) return 'top';

    const diff = (playerIndex - currentIndex + players.length) % players.length;

    if (diff === 1) return 'right';
    if (diff === 3) return 'left';

    return 'left'; // fallback
  };

  const currentHighestDeclarationPlayer = players.find(p => p.playerId === currentHighestDeclaration?.playerId)?.name;

  return (
    <>
      <GameInfo
        currentTrump={currentTrump}
        currentHighestDeclarationPlayer={currentHighestDeclarationPlayer ?? null}
        numberOfPairs={currentHighestDeclaration?.numberOfPairs ?? 0}
        teamScores={teamScores}
        currentRoomId={currentRoomId}
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
        {players.map((player) => {
          const position = getRelativePosition(player);
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
              position={position}
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