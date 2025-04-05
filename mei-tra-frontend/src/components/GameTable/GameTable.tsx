import React from 'react';
import { Player, Team, GamePhase, TrumpType, Field, CompletedField, BlowDeclaration, TeamScores, GameActions } from '@/types/game.types';
import { PlayerHand } from '../PlayerHand/PlayerHand';
import { GameField } from '../GameField/GameField';
import { GameControls } from '@/app/components/GameControls';
import { BlowControls } from '@/app/components/BlowControls/BlowControls';
import { GameInfo } from '../GameInfo/GameInfo';


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

  return (
    <div className={`game-layout ${gamePhase === 'blow' ? 'game-phase-blow' : ''}`}>
      <GameInfo
        currentTrump={currentTrump}
        numberOfPairs={currentHighestDeclaration?.numberOfPairs ?? 0}
        whoseTurn={whoseTurn}
        players={players}
        teamScores={teamScores}
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

      <div className="player-positions">
        {players.map((player) => (
          <PlayerHand
            key={player.playerId}
            player={player}
            isCurrentTurn={whoseTurn === player.playerId}
            negriCard={negriCard}
            negriPlayerId={negriPlayerId}
            gamePhase={gamePhase}
            whoseTurn={whoseTurn}
            gameActions={gameActions}
            position={getRelativePosition(player)}
            agariCard={revealedAgari || undefined}
            currentHighestDeclaration={currentHighestDeclaration || undefined}
            completedFields={completedFields}
            playerTeam={(players.find(p => p.playerId === currentPlayerId)?.team ?? 0) as Team}
            currentPlayerId={currentPlayerId || ''}
          />
        ))}

        {/* Center field */}
        <GameField
          currentField={currentField}
          players={players}
          onBaseSuitSelect={gameActions.selectBaseSuit}
          isCurrentPlayer={currentPlayerId === whoseTurn}
          currentTrump={currentTrump || ''}
        />
      </div>
    </div>
  );
}; 