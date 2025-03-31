'use client';

import { useEffect, useState } from 'react';
import { getSocket } from './socket';
import { BlowDeclaration, Field, GamePhase, Player, TeamScores, TrumpType } from './types';
import { CompletedField, FieldCompleteEvent } from '@/types/game.types';
import { GameTable } from '@/components/GameTable/GameTable';
import { TeamScore, TeamScoreRecord } from '@/types/game.types';
import { ScoreBoard } from '@/components/ScoreBoard';
import { GameJoinForm } from '@/components/GameJoinForm';
import { Notification } from '@/components/Notification/Notification';

export default function Home() {
  // Player and Game State
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>(null);
  const [whoseTurn, setWhoseTurn] = useState<string | null>(null);
  const [teamScores, setTeamScores] = useState<TeamScores>({
    0: { deal: 0, blow: 0, play: 0, total: 0 },
    1: { deal: 0, blow: 0, play: 0, total: 0 }
  });
  const [teamScoreRecords, setTeamScoreRecords] = useState<{ [key: number]: TeamScoreRecord }>({});
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

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    const socket = getSocket();

    // Set up reconnection token
    const savedToken = localStorage.getItem('reconnectToken');
    if (savedToken) {
      socket.auth = { reconnectToken: savedToken };
    }

    const socketHandlers = {
      'update-players': (players: Player[]) => {
        console.log('update-players event received');
        console.log('Players updated:', players);
        setPlayers(players);
      },
      'game-state': ({
        players,
        gamePhase,
        currentField,
        currentTurn,
        blowState,
        teamScores,
        you,
      }: {
        players: Player[];
        gamePhase: GamePhase;
        currentField: Field | null;
        currentTurn: string;
        blowState: {
          currentTrump: TrumpType | null;
          currentHighestDeclaration: BlowDeclaration | null;
          declarations: BlowDeclaration[];
        };
        teamScores: TeamScores;
        you: string;
      }) => {
        setPlayers(players);
        setGamePhase(gamePhase);
        setCurrentField(currentField);
        setWhoseTurn(currentTurn);
        setCurrentTrump(blowState.currentTrump);
        setCurrentHighestDeclaration(blowState.currentHighestDeclaration);
        setBlowDeclarations(blowState.declarations);
        setTeamScores(teamScores);
        setCurrentPlayerId(you);
        setGameStarted(true);
      },
      'game-started': (players: Player[]) => {
        console.log('Game started with players:', players);
        setPlayers(players);
        const id = getSocket().id;
        const index = players.findIndex(p => p.id === id);
        setCurrentPlayerId(players[index].playerId);
        setGameStarted(true);
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
        
        // Only show alert for phases other than 'play' and when not transitioning to a new round
        if (winner !== null && phase !== 'play' && phase !== 'blow') {
          alert(`Team ${winner} won the ${phase} phase!`);
        }
      },
      'error-message': (message: string) => alert(message),
      'update-turn': (playerId: string) => {
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
            p.playerId === lastPasser ? { ...p, isPasser: true } : p
          ));
        }
      },
      'broken': ({ nextDealer, players }: { nextDealer: string; players: Player[] }) => {
        setNotification({
          message: 'Broken happened, reset the game',
          type: 'warning'
        });
        setPlayers(players);
        setWhoseTurn(nextDealer);
        resetBlowState();
      },
      'round-reset': () => {
        resetBlowState();
      },
      'round-cancelled': ({ nextDealer, players }: { nextDealer: string; players: Player[] }) => {
        setNotification({
          message: 'Round cancelled! All players passed.',
          type: 'warning'
        });
        setPlayers(players);
        setWhoseTurn(nextDealer);
        resetBlowState();
      },
      'reveal-agari': ({ agari, message }: { agari: string, message: string }) => {
        console.log('Revealing Agari card:', agari);
        setRevealedAgari(agari);
        
        // Add Agari card to player's hand for testing
        setPlayers(players.map(p =>
          p.playerId === currentPlayerId
            ? { ...p, hand: [...p.hand, agari] }
            : p
        ));
        
        setNotification({
          message,
          type: 'success'
        });
      },
      'play-setup-complete': ({ negriCard, startingPlayer }: { negriCard: string, startingPlayer: string }) => {
        setRevealedAgari(null);
        setNegriCard(negriCard);
        setNegriPlayerId(startingPlayer);
        // Remove Negri card from player's hand
        setPlayers(players.map(p => 
          p.playerId === currentPlayerId 
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
      },
      'field-updated': (field: Field) => {
        setCurrentField(field);
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
      },
      'reconnect-token': (token: string) => {
        setReconnectToken(token);
        localStorage.setItem('reconnectToken', token);
      },
    };

    // Register all socket handlers
    Object.entries(socketHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup socket handlers
    return () => {
      Object.keys(socketHandlers).forEach((event) => {
        socket.off(event, socketHandlers[event as keyof typeof socketHandlers]);
      });
    };
  }, [name, currentHighestDeclaration, players]);

  const resetBlowState = () => {
    setBlowDeclarations([]);
    setCurrentHighestDeclaration(null);
    setSelectedTrump(null);
    setNumberOfPairs(0);
  };

  const gameActions = {
    joinGame: () => {
      if (name.trim()) {
        const socket = getSocket();
        if (reconnectToken) {
          socket.auth = { reconnectToken };
        } else {
          socket.auth = { name };
        }
        socket.connect();
      }
    },
    startGame: () => {
      console.log('Starting game with players:', players);
      getSocket().emit('start-game');
    },
    declareBlow: () => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn to declare!");
        return;
      }
      if (!selectedTrump || numberOfPairs < 1) {
        alert('Please select a trump type and number of pairs!');
        return;
      }
      getSocket().emit('declare-blow', {
        trumpType: selectedTrump,
        numberOfPairs,
      });
    },
    passBlow: () => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn to pass!2");
        return;
      }
      getSocket().emit('pass-blow');
    },
    selectNegri: (card: string) => {
      getSocket().emit('select-negri', card);
    },
    playCard: (card: string) => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn!");
        return;
      }
      getSocket().emit('play-card', card);
    },
    selectBaseSuit: (suit: string) => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn to select base suit!");
        return;
      }
      getSocket().emit('select-base-suit', suit);
    },
    revealBrokenHand: (playerId: string) => {
      getSocket().emit('reveal-broken-hand', playerId);
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <main className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-6xl mx-auto">
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
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
              whoseTurn={whoseTurn}
              gamePhase={gamePhase}
              currentTrump={currentTrump}
              currentField={currentField}
              players={players}
              negriCard={negriCard}
              negriPlayerId={negriPlayerId}
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
              currentPlayerId={currentPlayerId}
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
