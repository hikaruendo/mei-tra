'use client';

import { useEffect, useState } from 'react';
import { getSocket } from './socket';

interface Player {
  id: string;
  name: string;
  hand: string[];
  team?: number; // 0 or 1 for team number
  isPasser?: boolean;
}

interface TeamScore {
  deal: number;
  blow: number;
  play: number;
  total: number;
}

export default function Home() {
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [whoseTurn, setWhoseTurn] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ team0: Player[], team1: Player[] }>({ team0: [], team1: [] });
  const [gamePhase, setGamePhase] = useState<'deal' | 'blow' | 'play' | null>(null);
  const [teamScores, setTeamScores] = useState<{ [key: number]: TeamScore }>({
    0: { deal: 0, blow: 0, play: 0, total: 0 },
    1: { deal: 0, blow: 0, play: 0, total: 0 }
  });
  const [agari, setAgari] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    const socket = getSocket();

    socket.on('update-players', (players: Player[]) => {
      setPlayers(players);
      // Organize players into teams
      const team0 = players.filter(p => p.team === 0);
      const team1 = players.filter(p => p.team === 1);
      setTeams({ team0, team1 });
    });

    socket.on('game-started', (players: Player[]) => {
      setPlayers(players);
      setGameStarted(true);
    });

    socket.on('update-phase', ({ phase, scores, winner }) => {
      setGamePhase(phase);
      setTeamScores(scores);
      if (winner !== null) {
        alert(`Team ${winner} won the ${phase} phase!`);
      }
    });

    socket.on('update-agari', ({ agari }) => {
      setAgari(agari);
    });

    socket.on("error-message", (message) => {
      alert(message);
    });

    socket.on('update-turn', (playerId: string) => {
      console.log('Turn changed to:', playerId);
      setCurrentTurn(playerId);
      setWhoseTurn(playerId);
      console.log('currentTurn state:', playerId);
    });

    socket.on("game-over", ({ winner, finalScores }) => {
      alert(`${winner} won the game!\n\nFinal Scores:\nTeam 0: ${finalScores[0].total} points\nTeam 1: ${finalScores[1].total} points`);
      setGameStarted(false);
      setGamePhase(null);
      setTeamScores({
        0: { deal: 0, blow: 0, play: 0, total: 0 },
        1: { deal: 0, blow: 0, play: 0, total: 0 }
      });
    });

    return () => {
      socket.off('update-players');
      socket.off('game-started');
      socket.off('update-phase');
      socket.off('update-agari');
      socket.off("error-message");
      socket.off('update-turn');
      socket.off("game-over");
    };
  }, []);

  if (!isClient) {
    return null; // Prevents SSR rendering issues
  }

  const joinGame = () => {
    if (name.trim()) {
      getSocket().emit('join-game', name);
    }
  };

  const startGame = () => {
    const socket = getSocket();
    socket.emit('start-game');
  };

  const endPhase = () => {
    const socket = getSocket();
    if (currentTurn !== socket.id) {
      alert("It's not your turn!");
      return;
    }
    socket.emit('end-phase');
  };

  const handleDiscardPairs = () => {
    const socket = getSocket();
    if (!currentTurn) {
      alert("Turn system is not working! No turn assigned.");
      return;
    }

    if (currentTurn !== socket.id) {
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
  };

  const handleDrawCard = (fromPlayerId: string) => {
    const socket = getSocket();

    if (currentTurn !== socket.id) {
        alert("It's not your turn!");
        return;
    }

    socket.emit('draw-card', { fromPlayerId });
  };

  const renderPlayerHand = (player: Player) => {
    const isCurrentPlayer = player.id === getSocket().id;
    
    if (isCurrentPlayer) {
      return (
        <div>
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
    } else {
      return (
        <div className="flex gap-2">
          {Array(player.hand.length).fill('🂠').map((card, index) => (
            <span key={index} className="card face-down">
              {card}
            </span>
          ))}
        </div>
      );
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-24">
      {!gameStarted ? (
        <>
          <input type="text" placeholder="Enter name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded p-2 mb-4" />
          <button onClick={joinGame} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Join Game</button>
          <button onClick={startGame} disabled={players.length < 4} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2 disabled:opacity-50">Start Game</button>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4">Game Started</h2>
          <div className="mb-4">
            <h3 className="text-xl font-bold">Current Phase: {gamePhase?.toUpperCase()}</h3>
            <div className="flex justify-center gap-8 mt-2">
              <div className="text-center">
                <h4 className="font-bold">Team 0</h4>
                <p>Deal: {teamScores[0].deal}</p>
                <p>Blow: {teamScores[0].blow}</p>
                <p>Play: {teamScores[0].play}</p>
                <p className="font-bold">Total: {teamScores[0].total}</p>
              </div>
              <div className="text-center">
                <h4 className="font-bold">Team 1</h4>
                <p>Deal: {teamScores[1].deal}</p>
                <p>Blow: {teamScores[1].blow}</p>
                <p>Play: {teamScores[1].play}</p>
                <p className="font-bold">Total: {teamScores[1].total}</p>
              </div>
            </div>
          </div>
          
          {/* Agari Card */}
          {agari && (
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4">Agari Card</h3>
              <span className="card face-down">🂠</span>
            </div>
          )}
          
          {whoseTurn && <p>It is {players.find(p => p.id === whoseTurn)?.name}&apos;s turn</p>}
          
          {/* Team 1 (Top) */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4">Team 1</h3>
            <div className="flex justify-center gap-4">
              {teams.team1.map((player) => (
                <div key={player.id} className={`card-container ${whoseTurn === player.id ? 'current-turn' : ''}`}>
                  <strong className="font-bold player-name">{player.name}</strong> - <span className="card-count">{player.hand.length} cards</span>
                  {renderPlayerHand(player)}
                </div>
              ))}
            </div>
          </div>

          {/* Team 0 (Bottom) */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4">Team 0</h3>
            <div className="flex justify-center gap-4">
              {teams.team0.map((player) => (
                <div key={player.id} className={`card-container ${whoseTurn === player.id ? 'current-turn' : ''}`}>
                  <strong className="font-bold player-name">{player.name}</strong> - <span className="card-count">{player.hand.length} cards</span>
                  {renderPlayerHand(player)}
                </div>
              ))}
            </div>
          </div>

          {/* Game Controls */}
          <div className="flex gap-4 mt-4">
            {selectedCards.length === 2 && getSocket().id === whoseTurn && (
              <button onClick={handleDiscardPairs} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                Discard Pairs
              </button>
            )}
            {getSocket().id === whoseTurn && (
              <button onClick={endPhase} className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                End Phase
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
