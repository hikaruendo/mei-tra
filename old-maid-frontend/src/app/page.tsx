'use client';

import { useEffect, useState } from 'react';
import { getSocket } from './socket';

interface Player {
  id: string;
  name: string;
  hand: string[];
}

export default function Home() {
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);

  const handleCardClick = (card: string) => {
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter((c) => c !== card));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  useEffect(() => {
    setIsClient(true);
    const socket = getSocket();

    socket.on('update-players', (players: Player[]) => {
      setPlayers(players);
    });

    socket.on('game-started', (players: Player[]) => {
      setPlayers(players);
      setGameStarted(true);
    });

    socket.on("error-message", (message) => {
      alert(message);
    });
  
    socket.on("game-over", ({ loser }) => {
      alert(`${loser} lost the game!`);
      setGameStarted(false);
    });

    return () => {
      socket.off('update-players');
      socket.off('game-started');
      socket.off("error-message");
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

  const handleDiscardPairs = () => {
    const socket = getSocket();
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

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-24">
      {!gameStarted ? (
        <>
          <input type="text" placeholder="Enter name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded p-2 mb-4" />
          <button onClick={joinGame} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Join Game</button>
          <button onClick={startGame} disabled={players.length < 2} className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2 disabled:opacity-50">Start Game</button>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4">Game Started</h2>
          {players.map((player) => (
            <div key={player.id} className="mb-2 card-container">
              <strong className="font-bold player-name">{player.name}</strong> - <span className="card-count">{player.hand.length} cards</span>
              <div>
                {player.hand.map((card, index) => (
                  <span
                    key={index}
                    className={`card ${selectedCards.includes(card) ? 'selected' : ''}`}
                    onClick={() => handleCardClick(card)}
                  >
                    {card}
                  </span>
                ))}
              </div>
              {selectedCards.length === 2 && (
                <button onClick={handleDiscardPairs} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Discard Pairs</button>
              )}
            </div>
          ))}
        </>
      )}
    </main>
  );
}
