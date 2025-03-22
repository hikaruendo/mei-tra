'use client';

import { useEffect, useState } from 'react';
import { getSocket } from './socket';
import { BlowDeclaration, Field, GamePhase, Player, TeamPlayers, TeamScores, TrumpType } from './types';
import { CompletedField, FieldCompleteEvent } from '@/types/game.types';
import { GameTable } from '@/components/GameTable/GameTable';
import { TeamScore, TeamScoreRecord } from '@/types/game.types';
import { ScoreBoard } from '@/components/ScoreBoard';
import { GameJoinForm } from '@/components/GameJoinForm';

export default function Home() {
  // Player and Game State
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>(null);
  const [whoseTurn, setWhoseTurn] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamPlayers>({ team0: [], team1: [] });
  const [teamScores, setTeamScores] = useState<TeamScores>({
    0: { deal: 0, blow: 0, play: 0, total: 0 },
    1: { deal: 0, blow: 0, play: 0, total: 0 }
  });
  const [teamScoreRecords, setTeamScoreRecords] = useState<{ [key: number]: TeamScoreRecord }>({});

  // Card State
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  // Blow Phase State
  const [blowDeclarations, setBlowDeclarations] = useState<BlowDeclaration[]>([]);
  const [currentHighestDeclaration, setCurrentHighestDeclaration] = useState<BlowDeclaration | null>(null);
  const [selectedTrump, setSelectedTrump] = useState<TrumpType | null>(null);
  const [numberOfPairs, setNumberOfPairs] = useState<number>(0);

  // Client-side rendering guard
  const [isClient, setIsClient] = useState(false);

  const [revealedAgari, setRevealedAgari] = useState<string | null>(null);
  const [currentField, setCurrentField] = useState<Field | null>(null);
  const [currentTrump, setCurrentTrump] = useState<TrumpType | null>(null);
  const [negriCard, setNegriCard] = useState<string | null>(null);
  const [negriPlayerId, setNegriPlayerId] = useState<string | null>(null);

  // Add state for completed fields
  const [completedFields, setCompletedFields] = useState<CompletedField[]>([]);

  const [roundNumber, setRoundNumber] = useState(1);

  useEffect(() => {
    setIsClient(true);
    const socket = getSocket();

    const socketHandlers = {
      'update-players': (players: Player[]) => {
        console.log('update-players event received');
        console.log('Players updated:', players);
        setPlayers(players);
        setTeams({
          team0: players.filter(p => p.team === 0),
          team1: players.filter(p => p.team === 1)
        });
      },
      'game-started': (players: Player[]) => {
        console.log('Game started with players:', players);
        setPlayers(players);
        setGameStarted(true);
        setTeams({
          team0: players.filter(p => p.team === 0),
          team1: players.filter(p => p.team === 1)
        });
      },
      'update-phase': ({ phase, scores, winner }: { phase: GamePhase; scores: TeamScores; winner: number | null }) => {
        setGamePhase(phase);
        setTeamScores(scores);
        
        // Set current trump when transitioning to play phase
        if (phase === 'play') {
          if (currentHighestDeclaration) {
            setCurrentTrump(currentHighestDeclaration.trumpType);
          } else {
            // If no declaration was made, set to default trump
            setCurrentTrump('hel');
          }
        } else {
          // Reset current trump when not in play phase
          setCurrentTrump(null);
        }
        
        // Only show alert for phases other than 'play'
        if (winner !== null && phase !== 'play') {
          alert(`Team ${winner} won the ${phase} phase!`);
        }
      },
      'error-message': (message: string) => alert(message),
      'update-turn': (playerId: string) => {
        console.log('Turn changed to:', playerId);
        setWhoseTurn(playerId);
        // Add notification for turn change
        const nextPlayer = players.find(p => p.id === playerId)?.name;
        if (nextPlayer && (gamePhase === 'blow' || gamePhase === 'play')) {
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-out';
          notification.textContent = `Turn changed to ${nextPlayer}`;
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 3000);
        }
      },
      'game-over': ({ winner, finalScores }: { winner: string; finalScores: TeamScores }) => {
        alert(`${winner} won the game!\n\nFinal Scores:\nTeam 0: ${finalScores[0].total} points\nTeam 1: ${finalScores[1].total} points`);
        setGameStarted(false);
        setGamePhase(null);
        setTeamScores({
          0: { deal: 0, blow: 0, play: 0, total: 0 },
          1: { deal: 0, blow: 0, play: 0, total: 0 }
        });
      },
      'blow-started': ({ startingPlayer, players }: { startingPlayer: string; players: Player[] }) => {
        setGamePhase('blow');
        setPlayers(players);
        setWhoseTurn(startingPlayer);
      },
      'blow-updated': ({ declarations, currentHighest, lastPasser }: { declarations: BlowDeclaration[]; currentHighest: BlowDeclaration | null; lastPasser: string | null }) => {
        setBlowDeclarations(declarations);
        setCurrentHighestDeclaration(currentHighest);
        if (lastPasser) {
          setPlayers(players.map(p => 
            p.id === lastPasser ? { ...p, isPasser: true } : p
          ));
        }
      },
      'hand-broken': ({ playerId, hand }: { playerId: string; hand: string[] }) => {
        const player = players.find(p => p.id === playerId)?.name;
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-out';
        notification.textContent = `${player} has a broken hand!`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        setPlayers(players.map(p => 
          p.id === playerId ? { ...p, hasBroken: true, hand } : p
        ));
      },
      'round-reset': () => {
        resetBlowState();
      },
      'round-cancelled': ({ nextDealer, players }: { nextDealer: string; players: Player[] }) => {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-out';
        notification.textContent = 'Round cancelled! All players passed.';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        setPlayers(players);
        setWhoseTurn(nextDealer);
        resetBlowState();
      },
      'reveal-agari': ({ agari, message }: { agari: string, message: string }) => {
        console.log('Revealing Agari card:', agari);
        setRevealedAgari(agari);
        
        // Add Agari card to player's hand for testing
        setPlayers(players.map(p =>
          p.id === getSocket().id
            ? { ...p, hand: [...p.hand, agari] }
            : p
        ));
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-out';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
      },
      'play-setup-complete': ({ negriCard, startingPlayer }: { negriCard: string, startingPlayer: string }) => {
        setRevealedAgari(null);
        setNegriCard(negriCard);
        setNegriPlayerId(startingPlayer);
        // Remove Negri card from player's hand
        setPlayers(players.map(p => 
          p.id === getSocket().id 
            ? { ...p, hand: p.hand.filter(card => card !== negriCard) }
            : p
        ));
        // Get the current trump from the highest declaration
        if (currentHighestDeclaration) {
          setCurrentTrump(currentHighestDeclaration.trumpType);
        }
      },
      'card-played': ({ field, players: updatedPlayers }: { field: Field, players: Player[] }) => {
        setCurrentField(field);
        // Update players with the latest data from server
        setPlayers(updatedPlayers);
        // Update teams with the latest data
        setTeams({
          team0: updatedPlayers.filter(p => p.team === 0),
          team1: updatedPlayers.filter(p => p.team === 1)
        });
      },
      'field-complete': ({ field, nextPlayerId }: FieldCompleteEvent) => {
        setCompletedFields(prev => [...prev, field]);
        setCurrentField({ cards: [], baseCard: '', dealerId: nextPlayerId, isComplete: false });
      },
      'round-results': ({ roundNumber, scores, scoreRecords }: {
        roundNumber: number;
        scores: { [key: number]: TeamScore };
        scoreRecords: { [key: number]: TeamScoreRecord };
      }) => {
        setTeamScores(scores as TeamScores);
        setTeamScoreRecords(scoreRecords);
        setRoundNumber(roundNumber);
      },
      'new-round-started': ({
        players,
        currentTurn,
        gamePhase,
        currentField,
        completedFields,
        negriCard,
        negriPlayerId,
        revealedAgari,
        currentTrump,
        currentHighestDeclaration,
        blowDeclarations,
      }: {
        players: Player[];
        currentTurn: string;
        gamePhase: GamePhase;
        currentField: Field | null;
        completedFields: CompletedField[];
        negriCard: string | null;
        negriPlayerId: string | null;
        revealedAgari: string | null;
        currentTrump: TrumpType | null;
        currentHighestDeclaration: BlowDeclaration | null;
        blowDeclarations: BlowDeclaration[];
      }) => {
        setPlayers(players);
        setWhoseTurn(currentTurn);
        setGamePhase(gamePhase);
        setCurrentField(currentField);
        setCompletedFields(completedFields);
        setNegriCard(negriCard);
        setNegriPlayerId(negriPlayerId);
        setRevealedAgari(revealedAgari);
        setCurrentTrump(currentTrump);
        setCurrentHighestDeclaration(currentHighestDeclaration);
        setBlowDeclarations(blowDeclarations);
      }
    };

    // Register all socket handlers
    Object.entries(socketHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup socket handlers
    return () => {
      Object.keys(socketHandlers).forEach(event => {
        socket.off(event);
      });
    };
  }, [gamePhase, players, currentHighestDeclaration, whoseTurn]);

  const resetBlowState = () => {
    setBlowDeclarations([]);
    setCurrentHighestDeclaration(null);
    setSelectedTrump(null);
    setNumberOfPairs(0);
  };

  const gameActions = {
    joinGame: () => {
      if (name.trim()) {
        getSocket().emit('join-game', name);
      }
    },
    startGame: () => {
      console.log('Starting game with players:', players);
      getSocket().emit('start-game');
    },
    handleDiscardPairs: () => {
      const socket = getSocket();
      if (!whoseTurn) {
        alert("Turn system is not working! No turn assigned.");
        return;
      }

      if (whoseTurn !== socket.id) {
        alert("It's not your turn!");
        return;
      }

      if (selectedCards.length === 2) {
        const [card1, card2] = selectedCards;
        const value1 = card1.replace(/[♠♣♥♦]/, '');
        const value2 = card2.replace(/[♠♣♥♦]/, '');

        if (value1 === value2 && value1 !== 'JOKER') {
          socket.emit('discard-pairs', selectedCards);
          setSelectedCards([]);
        } else {
          alert('Selected cards are not a pair!');
        }
      }
    },
    startBlow: () => {
      const socket = getSocket();
      if (whoseTurn !== socket.id) {
        alert("It's not your turn to start the blow phase!");
        return;
      }
      socket.emit('start-blow');
    },
    declareBlow: () => {
      const socket = getSocket();
      if (!selectedTrump || numberOfPairs < 1) {
        alert('Please select a trump type and number of pairs!');
        return;
      }

      socket.emit('declare-blow', {
        trumpType: selectedTrump,
        numberOfPairs,
      });
    },
    passBlow: () => {
      const socket = getSocket();
      if (whoseTurn !== socket.id) {
        alert("It's not your turn to pass!");
        return;
      }
      socket.emit('pass-blow');
    },
    selectNegri: (card: string) => {
      const socket = getSocket();
      socket.emit('select-negri', card);
    },
    playCard: (card: string) => {
      const socket = getSocket();
      if (whoseTurn !== socket.id) {
        alert("It's not your turn!");
        return;
      }
      socket.emit('play-card', card);
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <main className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-6xl mx-auto">
        {!gameStarted ? (
          <GameJoinForm
            name={name}
            onNameChange={setName}
            onJoinGame={gameActions.joinGame}
            onStartGame={gameActions.startGame}
            playerCount={players.length}
          />
        ) : (
          <>
            <GameTable
              teams={teams}
              whoseTurn={whoseTurn}
              gamePhase={gamePhase}
              currentTrump={currentTrump}
              currentField={currentField}
              players={players}
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
              selectedCards={selectedCards}
              setSelectedCards={setSelectedCards}
              completedFields={completedFields}
              revealedAgari={revealedAgari}
              gameActions={gameActions}
              blowDeclarations={blowDeclarations}
              currentHighestDeclaration={currentHighestDeclaration}
              selectedTrump={selectedTrump}
              setSelectedTrump={setSelectedTrump}
              numberOfPairs={numberOfPairs}
              setNumberOfPairs={setNumberOfPairs}
              teamScores={teamScores}
            />
            {teamScores && teamScoreRecords && (
              <div className="mt-4">
                <ScoreBoard
                  teamScores={teamScores}
                  teamScoreRecords={teamScoreRecords}
                  roundNumber={roundNumber}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
