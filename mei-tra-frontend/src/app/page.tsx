'use client';

import { useEffect, useState } from 'react';
import { getSocket } from './socket';
import { BlowControls } from './components/BlowControls';
import { GameControls } from './components/GameControls';
import { ScoreDisplay } from './components/ScoreDisplay';
import { TeamDisplay } from './components/TeamDisplay';
import { BlowDeclaration, GamePhase, Player, TeamPlayers, TeamScores, TrumpType } from './types';

export default function Home() {
  // Player and Game State
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>(null);
  const [whoseTurn, setWhoseTurn] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamPlayers>({ team0: [], team1: [] });

  // Card State
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [agari, setAgari] = useState<string | null>(null);

  // Score State
  const [teamScores, setTeamScores] = useState<TeamScores>({
    0: { deal: 0, blow: 0, play: 0, total: 0 },
    1: { deal: 0, blow: 0, play: 0, total: 0 }
  });

  // Blow Phase State
  const [blowDeclarations, setBlowDeclarations] = useState<BlowDeclaration[]>([]);
  const [currentHighestDeclaration, setCurrentHighestDeclaration] = useState<BlowDeclaration | null>(null);
  const [selectedTrump, setSelectedTrump] = useState<TrumpType | null>(null);
  const [numberOfPairs, setNumberOfPairs] = useState<number>(0);

  // Client-side rendering guard
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const socket = getSocket();

    const socketHandlers = {
      'update-players': (players: Player[]) => {
        setPlayers(players);
        setTeams({
          team0: players.filter(p => p.team === 0),
          team1: players.filter(p => p.team === 1)
        });
      },
      'game-started': (players: Player[]) => {
        setPlayers(players);
        setGameStarted(true);
      },
      'update-phase': ({ phase, scores, winner }: { phase: GamePhase; scores: TeamScores; winner: number | null }) => {
        setGamePhase(phase);
        setTeamScores(scores);
        if (winner !== null) {
          alert(`Team ${winner} won the ${phase} phase!`);
        }
      },
      'update-agari': ({ agari }: { agari: string }) => setAgari(agari),
      'error-message': (message: string) => alert(message),
      'update-turn': (playerId: string) => {
        console.log('Turn changed to:', playerId);
        setWhoseTurn(playerId);
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
        alert(`Player ${players.find(p => p.id === playerId)?.name} has a broken hand!`);
        setPlayers(players.map(p => 
          p.id === playerId ? { ...p, hasBroken: true, hand } : p
        ));
      },
      'round-reset': ({ nextDealer, players }: { nextDealer: string; players: Player[] }) => {
        setPlayers(players);
        setWhoseTurn(nextDealer);
        resetBlowState();
      },
      'round-cancelled': ({ nextDealer, players }: { nextDealer: string; players: Player[] }) => {
        alert('Round cancelled! All players passed.');
        setPlayers(players);
        setWhoseTurn(nextDealer);
        resetBlowState();
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
  }, [players]);

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
      getSocket().emit('start-game');
    },
    endPhase: () => {
      const socket = getSocket();
      if (whoseTurn !== socket.id) {
        alert("It's not your turn!");
        return;
      }
      socket.emit('end-phase');
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
    }
  };

  const renderPlayerHand = (player: Player) => {
    const isCurrentPlayer = player.id === getSocket().id;
    
    if (isCurrentPlayer) {
      return (
        <div className="flex flex-wrap gap-2">
          {player.hand.map((card, index) => (
            <span
              key={index}
              className={`card ${selectedCards.includes(card) ? 'selected' : ''} ${card.includes('♥') || card.includes('♦') ? 'red-suit' : ''}`}
              data-value={card.replace(/[♥♣♦♠]/, '')}
              onClick={() => setSelectedCards(selectedCards.includes(card) ? selectedCards.filter((c) => c !== card) : [...selectedCards, card])}
            >
              <span className={`suit ${card.includes('♠') || card.includes('♣') ? 'black-suit' : ''}`}>
                {card === 'JOKER' ? '🤡' : card.replace(/[^♥♣♦♠]/, '')}
              </span>
              {card}
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="flex gap-2">
        {Array(player.hand.length).fill('🂠').map((card, index) => (
          <span key={index} className="card face-down">
            {card}
          </span>
        ))}
      </div>
    );
  };

  if (!isClient) {
    return null;
  }

  if (!gameStarted) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-24">
        <input 
          type="text" 
          placeholder="Enter name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="border rounded p-2 mb-4" 
        />
        <div className="flex gap-2">
          <button 
            onClick={gameActions.joinGame} 
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Join Game
          </button>
          <button 
            onClick={gameActions.startGame} 
            disabled={players.length < 4} 
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            Start Game
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-24">
      <h2 className="text-2xl font-bold mb-4">Game Started</h2>
      
      <ScoreDisplay gamePhase={gamePhase} teamScores={teamScores} />
      
      {agari && (
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-4">Agari Card</h3>
          <span className="card face-down">🂠</span>
        </div>
      )}
      
      {whoseTurn && (
        <p className="mb-4">
          It is {players.find(p => p.id === whoseTurn)?.name}&apos;s turn
        </p>
      )}
      
      <TeamDisplay 
        teamNumber={1}
        players={teams.team1}
        whoseTurn={whoseTurn}
        renderPlayerHand={renderPlayerHand}
      />
      
      <TeamDisplay 
        teamNumber={0}
        players={teams.team0}
        whoseTurn={whoseTurn}
        renderPlayerHand={renderPlayerHand}
      />

      <GameControls 
        gamePhase={gamePhase}
        whoseTurn={whoseTurn}
        selectedCards={selectedCards}
        handleDiscardPairs={gameActions.handleDiscardPairs}
        endPhase={gameActions.endPhase}
        startBlow={gameActions.startBlow}
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
    </main>
  );
}
