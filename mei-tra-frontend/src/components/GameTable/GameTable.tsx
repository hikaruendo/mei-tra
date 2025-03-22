import React from 'react';
import { Player, Team, GamePhase, TrumpType, Field, CompletedField, BlowDeclaration, TeamScores } from '@/types/game.types';
import { PlayerHand } from '../PlayerHand/PlayerHand';
import { GameField } from '../GameField/GameField';
import { CompletedFields } from '../CompletedFields/CompletedFields';
import { PlaySetup } from '@/app/components/PlaySetup';
import { GameControls } from '@/app/components/GameControls';
import { BlowControls } from '@/app/components/BlowControls';
import { getSocket } from '@/app/socket';
import { GameInfo } from '../GameInfo/GameInfo';

interface TeamPlayers {
  team0: Player[];
  team1: Player[];
}

interface GameActions {
  selectNegri: (card: string) => void;
  playCard: (card: string) => void;
  declareBlow: () => void;
  passBlow: () => void;
}

interface GameTableProps {
  teams: TeamPlayers;
  whoseTurn: string | null;
  gamePhase: GamePhase | null;
  currentTrump: TrumpType | null;
  currentField: Field | null;
  players: Player[];
  negriCard: string | null;
  negriPlayerId: string | null;
  selectedCards: string[];
  setSelectedCards: (cards: string[]) => void;
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
  teams,
  whoseTurn,
  gamePhase,
  currentTrump,
  currentField,
  players,
  negriCard,
  negriPlayerId,
  selectedCards,
  setSelectedCards,
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
          whoseTurn={whoseTurn}
          selectedCards={selectedCards}
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
        {/* Top player */}
        <div className="player-position top">
          {teams.team1[0] && (
            <PlayerHand
              player={teams.team1[0]}
              isCurrentTurn={whoseTurn === teams.team1[0].id}
              selectedCards={selectedCards}
              setSelectedCards={setSelectedCards}
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
              gamePhase={gamePhase}
              whoseTurn={whoseTurn}
              gameActions={gameActions}
            />
          )}
        </div>

        {/* Right player */}
        <div className="player-position right">
          {teams.team0[0] && (
            <PlayerHand
              player={teams.team0[0]}
              isCurrentTurn={whoseTurn === teams.team0[0].id}
              selectedCards={selectedCards}
              setSelectedCards={setSelectedCards}
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
              gamePhase={gamePhase}
              whoseTurn={whoseTurn}
              gameActions={gameActions}
            />
          )}
        </div>

        {/* Bottom player */}
        <div className="player-position bottom">
          {teams.team1[1] && (
            <PlayerHand
              player={teams.team1[1]}
              isCurrentTurn={whoseTurn === teams.team1[1].id}
              selectedCards={selectedCards}
              setSelectedCards={setSelectedCards}
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
              gamePhase={gamePhase}
              whoseTurn={whoseTurn}
              gameActions={gameActions}
            />
          )}
        </div>

        {/* Left player */}
        <div className="player-position left">
          {teams.team0[1] && (
            <PlayerHand
              player={teams.team0[1]}
              isCurrentTurn={whoseTurn === teams.team0[1].id}
              selectedCards={selectedCards}
              setSelectedCards={setSelectedCards}
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
              gamePhase={gamePhase}
              whoseTurn={whoseTurn}
              gameActions={gameActions}
            />
          )}
        </div>

        {/* Center field */}
        <GameField
          currentField={currentField}
          players={players}
        />
      </div>

      {gamePhase === 'play' && revealedAgari && whoseTurn === players.find(p => p.id === getSocket().id)?.id && (
        <PlaySetup
          player={players.find(p => p.id === getSocket().id)!}
          agariCard={revealedAgari}
          onSelectNegri={gameActions.selectNegri}
          onSelectBaseCard={gameActions.playCard}
          hasSelectedNegri={!!negriCard}
        />
      )}

      <CompletedFields 
        fields={completedFields} 
        playerTeam={(players.find(p => p.id === getSocket().id)?.team ?? 0) as Team} 
      />
    </div>
  );
}; 