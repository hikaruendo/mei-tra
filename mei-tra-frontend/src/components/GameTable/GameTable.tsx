import React from 'react';
import { Player, Team, GamePhase, TrumpType, Field, CompletedField, BlowDeclaration, TeamScores } from '@/types/game.types';
import { PlayerHand } from '../PlayerHand/PlayerHand';
import { GameField } from '../GameField/GameField';
import { CompletedFields } from '../CompletedFields/CompletedFields';
import { GameControls } from '@/app/components/GameControls';
import { BlowControls } from '@/app/components/BlowControls';
import { getSocket } from '@/app/socket';
import { GameInfo } from '../GameInfo/GameInfo';

interface GameActions {
  selectNegri: (card: string) => void;
  playCard: (card: string) => void;
  declareBlow: () => void;
  passBlow: () => void;
}

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
}) => {
  return (
    <div className={`game-layout ${gamePhase === 'blow' ? 'game-phase-blow' : ''}`}>
      <GameInfo
        gamePhase={gamePhase}
        currentTrump={currentTrump}
        whoseTurn={whoseTurn}
        players={players}
        teamScores={teamScores}
      />

      {gamePhase && (
        <GameControls 
          gamePhase={gamePhase}
          renderBlowControls={() => (
            <BlowControls
              isCurrentPlayer={getSocket().id === whoseTurn}
              currentPlayer={players.find(p => p.id === getSocket().id)}
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
            key={player.id}
            player={player}
            isCurrentTurn={whoseTurn === player.id}
            negriCard={negriCard}
            negriPlayerId={negriPlayerId}
            gamePhase={gamePhase}
            whoseTurn={whoseTurn}
            gameActions={gameActions}
            players={players}
            agariCard={revealedAgari || undefined}
            currentHighestDeclaration={currentHighestDeclaration || undefined}
          />
        ))}

        {/* Center field */}
        <GameField
          currentField={currentField}
          players={players}
        />
      </div>

      <CompletedFields 
        fields={completedFields} 
        playerTeam={(players.find(p => p.id === getSocket().id)?.team ?? 0) as Team} 
      />
    </div>
  );
}; 