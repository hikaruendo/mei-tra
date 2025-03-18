'use client';

import { useEffect, useState } from 'react';
import { getSocket } from './socket';
import { BlowControls } from './components/BlowControls';
import { GameControls } from './components/GameControls';
import { ScoreDisplay } from './components/ScoreDisplay';
import { BlowDeclaration, Field, GamePhase, Player, TeamPlayers, TeamScores, TrumpType } from './types';
import { PlaySetup } from './components/PlaySetup';

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

  const [revealedAgari, setRevealedAgari] = useState<string | null>(null);
  const [currentField, setCurrentField] = useState<Field | null>(null);
  const [currentTrump, setCurrentTrump] = useState<TrumpType | null>(null);
  const [negriCard, setNegriCard] = useState<string | null>(null);
  const [negriPlayerId, setNegriPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    const socket = getSocket();

    const socketHandlers = {
      'update-players': (players: Player[]) => {
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
        if (phase === 'play' && currentHighestDeclaration) {
          setCurrentTrump(currentHighestDeclaration.trumpType);
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
      'round-reset': ({ nextDealer, players }: { nextDealer: string; players: Player[] }) => {
        setPlayers(players);
        setWhoseTurn(nextDealer);
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
      'card-played': ({ playerId, card, field }: { playerId: string, card: string, field: Field }) => {
        setCurrentField(field);
        // Update player hands
        setPlayers(players.map(p => 
          p.id === playerId ? { ...p, hand: p.hand.filter(c => c !== card) } : p
        ));
      },
      'field-complete': ({ winner, players }: { winner: string, field: Field, players: Player[] }) => {
        setCurrentField(null);
        setPlayers(players);
        const winnerName = players.find(p => p.id === winner)?.name;
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-purple-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-out';
        notification.textContent = `${winnerName} won the field!`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
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
  }, [gamePhase, players, currentHighestDeclaration]);

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

  const renderPlayerHand = (player: Player) => {
    const isCurrentPlayer = player.id === getSocket().id;
    
    if (isCurrentPlayer) {
      return (
        <div className="flex flex-wrap gap-2">
          {player.hand.map((card, index) => {
            const value = card.replace(/[♠♣♥♦]/, '');
            const suit = card.match(/[♠♣♥♦]/)?.[0] || '';
            const isRed = suit === '♥' || suit === '♦';
            const isNegri = card === negriCard;
            
            // Different click handler based on game phase
            const handleCardClick = () => {
              if (gamePhase === 'play' && whoseTurn === getSocket().id) {
                gameActions.playCard(card);
              } else {
                setSelectedCards(selectedCards.includes(card) 
                  ? selectedCards.filter((c) => c !== card) 
                  : [...selectedCards, card]);
              }
            };
            
            return (
              <div
                key={index}
                className={`card ${selectedCards.includes(card) ? 'selected' : ''} ${isRed ? 'red-suit' : 'black-suit'} ${isNegri ? 'negri-card' : ''}`}
                onClick={handleCardClick}
                style={{ transform: `rotate(${-15 + (index * 3)}deg)` }}
              >
                {card === 'JOKER' ? '🃏' : (
                  <>
                    {value}
                    <span className="suit">{suit}</span>
                  </>
                )}
                {isNegri && <div className="negri-label">Negri</div>}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex gap-2">
        {Array(player.hand.length).fill(null).map((_, index) => (
          <div
            key={index}
            className="card face-down"
            style={{ transform: `rotate(${-10 + (index * 2)}deg)` }}
          >
            🂠
          </div>
        ))}
      </div>
    );
  };

  if (!isClient) {
    return null;
  }

  if (!gameStarted) {
    console.log('Current players:', players);
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
            Start Game ({players.length}/4 players)
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-24">
      <style jsx global>{`
        @keyframes fadeOut {
          0% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
        .animate-fade-out {
          animation: fadeOut 3s forwards;
        }
        .negri-card-display {
          position: absolute;
          right: -80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.25rem;
          border-radius: 4px;
          z-index: 5;
          min-height: 100px;
          perspective: 1000px;
          width: 80px;
          opacity: 0.8;
        }
        .negri-card {
          border: 1px solid gold;
          box-shadow: 0 0 5px gold;
          transform: none !important;
          margin: 0 -10px;
          transition: transform 0.2s;
          cursor: pointer;
          background: white;
          color: black;
          width: 50px;
          height: 70px;
          font-size: 1rem;
        }
        .negri-card.red-suit {
          color: #D40000;
        }
        .negri-card.black-suit {
          color: #000000;
        }
        .negri-card .suit {
          font-size: 1.2rem;
          margin-top: 0.1rem;
        }
        .negri-card.face-down {
          background: #2060AA;
          color: white;
          font-size: 1.5rem;
        }
        .negri-label {
          position: absolute;
          top: -15px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: gold;
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 0.7rem;
          white-space: nowrap;
        }
        .game-layout {
          position: relative;
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #004400;
        }
        .game-info {
          position: fixed;
          top: 0;
          left: 0;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
          z-index: 20;
          max-width: 300px;
          border-bottom-right-radius: 8px;
        }
        .game-info > div {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }
        .current-trump {
          background: rgba(0, 0, 0, 0.5);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          text-align: left;
          width: 100%;
        }
        .turn-indicator {
          width: 100%;
        }
        .turn-indicator > div {
          width: 100%;
          text-align: left;
        }
        .player-positions {
          position: relative;
          width: 900px;
          height: 900px;
          margin-top: 100px;
        }
        .player-position {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          width: 300px;
        }
        .player-position.top {
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
        }
        .player-position.right {
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
        }
        .player-position.bottom {
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
        }
        .player-position.left {
          left: 20px;
          top: 50%;
          transform: translateY(-50%);
        }
        .field-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 200px;
          height: 200px;
          background: rgba(139, 69, 19, 0.3);
          border: 4px solid #8B4513;
          border-radius: 8px;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 5;
          pointer-events: none;
        }
        .field-container > div {
          pointer-events: auto;
        }
        .player-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #8B4513;
          padding: 1rem;
          border-radius: 0.5rem;
          border: 2px solid #5C2C0C;
          width: 100%;
        }
        .player-name {
          font-size: 1rem;
          color: white;
          margin-bottom: 0.25rem;
        }
        .card-count {
          font-size: 0.9rem;
          color: #FFD700;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
        }
        .hand-container {
          display: flex;
          justify-content: center;
          min-height: 120px;
          perspective: 1000px;
          width: 100%;
        }
        .hand-container .card {
          transition: transform 0.2s;
          cursor: pointer;
          margin: 0 -15px;
        }
        .hand-container .card:hover {
          transform: translateY(-10px) !important;
          z-index: 10;
        }
        .card {
          width: 60px;
          height: 84px;
          background: white;
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          position: relative;
          z-index: 1;
        }
        .card.face-down {
          background: #2060AA;
          color: white;
          font-size: 2rem;
          margin: 0 -15px;
        }
        .red-suit {
          color: #D40000;
        }
        .black-suit {
          color: #000000;
        }
        .suit {
          font-size: 1.4rem;
        }
        .hand-container {
          display: flex;
          justify-content: center;
          min-height: 100px;
          margin: 0.5rem;
          perspective: 1000px;
        }
        .hand-container .card {
          transition: transform 0.2s;
          cursor: pointer;
        }
        .hand-container .card:hover {
          transform: translateY(-10px) !important;
        }
        .current-turn {
          border: 2px solid #FFD700;
          box-shadow: 0 0 10px #FFD700;
        }
      `}</style>
      
      <div className="game-layout">
        <div className="game-info">
          <ScoreDisplay gamePhase={gamePhase} teamScores={teamScores} />
          
          {whoseTurn && (
            <div className="turn-indicator">
              <div className={`px-4 py-2 rounded-lg ${
                whoseTurn === getSocket().id 
                  ? 'bg-green-600 text-white animate-pulse'
                  : 'bg-gray-700 text-white'
              }`}>
                {whoseTurn === getSocket().id 
                  ? "It's Your Turn!"
                  : `${players.find(p => p.id === whoseTurn)?.name}'s Turn`
                }
              </div>
            </div>
          )}

          {gamePhase === 'play' && currentTrump && (
            <div className="current-trump">
              <div className="text-lg font-bold text-white">
                {currentTrump === 'tra' && 'Tra (No Trump)'}
                {currentTrump === 'hel' && 'Hel (Hearts ♥)'}
                {currentTrump === 'daya' && 'Daya (Diamonds ♦)'}
                {currentTrump === 'club' && 'Club (Clubs ♣)'}
                {currentTrump === 'zuppe' && 'Zuppe (Spades ♠)'}
              </div>
            </div>
          )}
        </div>

        <div className="player-positions">
          {/* Top player */}
          <div className="player-position top">
            {teams.team1[0] && (
              <div className={`player-info ${whoseTurn === teams.team1[0].id ? 'current-turn' : ''}`}>
                <div className="player-name">{teams.team1[0].name}</div>
                <div className="card-count">{teams.team1[0].hand.length} cards</div>
                {renderPlayerHand(teams.team1[0])}
                {negriCard && negriPlayerId === teams.team1[0].id && (
                  <div className="negri-card-display">
                    <div className="text-sm text-white mb-1">Negri Card</div>
                    {getSocket().id === negriPlayerId ? (
                      <div className="card negri-card">
                        {negriCard === 'JOKER' ? '🃏' : (
                          <>
                            {negriCard.replace(/[♠♣♥♦]/, '')}
                            <span className="suit">{negriCard.match(/[♠♣♥♦]/)?.[0]}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="card face-down negri-card">
                        🂠
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right player */}
          <div className="player-position right">
            {teams.team0[0] && (
              <div className={`player-info ${whoseTurn === teams.team0[0].id ? 'current-turn' : ''}`}>
                <div className="player-name">{teams.team0[0].name}</div>
                <div className="card-count">{teams.team0[0].hand.length} cards</div>
                {renderPlayerHand(teams.team0[0])}
                {negriCard && negriPlayerId === teams.team0[0].id && (
                  <div className="negri-card-display">
                    <div className="text-sm text-white mb-1">Negri Card</div>
                    {getSocket().id === negriPlayerId ? (
                      <div className="card negri-card">
                        {negriCard === 'JOKER' ? '🃏' : (
                          <>
                            {negriCard.replace(/[♠♣♥♦]/, '')}
                            <span className="suit">{negriCard.match(/[♠♣♥♦]/)?.[0]}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="card face-down negri-card">
                        🂠
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom player */}
          <div className="player-position bottom">
            {teams.team0[1] && (
              <div className={`player-info ${whoseTurn === teams.team0[1].id ? 'current-turn' : ''}`}>
                <div className="player-name">{teams.team0[1].name}</div>
                <div className="card-count">{teams.team0[1].hand.length} cards</div>
                {renderPlayerHand(teams.team0[1])}
                {negriCard && negriPlayerId === teams.team0[1].id && (
                  <div className="negri-card-display">
                    <div className="text-sm text-white mb-1">Negri Card</div>
                    {getSocket().id === negriPlayerId ? (
                      <div className="card negri-card">
                        {negriCard === 'JOKER' ? '🃏' : (
                          <>
                            {negriCard.replace(/[♠♣♥♦]/, '')}
                            <span className="suit">{negriCard.match(/[♠♣♥♦]/)?.[0]}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="card face-down negri-card">
                        🂠
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Left player */}
          <div className="player-position left">
            {teams.team1[1] && (
              <div className={`player-info ${whoseTurn === teams.team1[1].id ? 'current-turn' : ''}`}>
                <div className="player-name">{teams.team1[1].name}</div>
                <div className="card-count">{teams.team1[1].hand.length} cards</div>
                {renderPlayerHand(teams.team1[1])}
                {negriCard && negriPlayerId === teams.team1[1].id && (
                  <div className="negri-card-display">
                    <div className="text-sm text-white mb-1">Negri Card</div>
                    {getSocket().id === negriPlayerId ? (
                      <div className="card negri-card">
                        {negriCard === 'JOKER' ? '🃏' : (
                          <>
                            {negriCard.replace(/[♠♣♥♦]/, '')}
                            <span className="suit">{negriCard.match(/[♠♣♥♦]/)?.[0]}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="card face-down negri-card">
                        🂠
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center field */}
          {currentField && currentField.cards.length > 0 && (
            <div className="field-container">
              <div className="flex gap-4 justify-center">
                {currentField.cards.map((card: string, index: number) => {
                  const isRed = card.match(/[♥♦]/);
                  const playerId = players[index % players.length]?.id;
                  const playerName = players.find(p => p.id === playerId)?.name;
                  
                  return (
                    <div key={index} className="text-center">
                      <div className="text-white mb-2">{playerName}</div>
                      <div className={`card ${isRed ? 'red-suit' : 'black-suit'}`}>
                        {card === 'JOKER' ? '🃏' : (
                          <>
                            {card.replace(/[♠♣♥♦]/, '')}
                            <span className="suit">{card.match(/[♠♣♥♦]/)?.[0]}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {gamePhase === 'play' && revealedAgari && whoseTurn === getSocket().id && (
          <PlaySetup
            player={players.find(p => p.id === getSocket().id)!}
            agariCard={revealedAgari}
            onSelectNegri={gameActions.selectNegri}
            onSelectBaseCard={gameActions.playCard}
            hasSelectedNegri={!!negriCard}
          />
        )}

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
      </div>
    </main>
  );
}
