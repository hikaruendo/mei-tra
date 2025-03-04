"use client";

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

  useEffect(() => {
    const socket = getSocket();

    socket.on('update-players', (players: Player[]) => {
      setPlayers(players);
    });

    socket.on('game-started', (players: Player[]) => {
      setPlayers(players);
      setGameStarted(true);
    });

    return () => {
      socket.off('update-players');
      socket.off('game-started');
    };
  }, []);

  const joinGame = () => {
    if (name.trim()) {
      getSocket().emit('join-game', name);
    }
  };

  const startGame = () => {
    getSocket().emit('start-game');
  };

  return (
    <div style={{ padding: '20px' }}>
      {!gameStarted ? (
        <>
          <input type="text" placeholder="Enter name" value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={joinGame}>Join Game</button>
          <button onClick={startGame} disabled={players.length < 2}>Start Game</button>
        </>
      ) : (
        <>
          <h2>Game Started</h2>
          {players.map((player) => (
            <div key={player.id}>
              <strong>{player.name}</strong> - {player.hand.length} cards
            </div>
          ))}
        </>
      )}
    </div>
  );
}