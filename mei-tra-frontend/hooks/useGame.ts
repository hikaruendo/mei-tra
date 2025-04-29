import { useState, useEffect } from 'react';
import { getSocket } from '../app/socket';
import { BlowDeclaration, CompletedField, Field, FieldCompleteEvent, GamePhase, Player, TeamScore, TeamScores, TrumpType, User } from '../types/game.types';

export const useGame = () => {
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

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);


  useEffect(() => {
    setIsClient(true);
    const socket = getSocket();

    // Set up reconnection token
    const savedToken = sessionStorage.getItem('reconnectToken');
    if (savedToken) {
      socket.auth = { reconnectToken: savedToken };
    }

    const socketHandlers = {
      // ユーザーの更新
      'update-users': (users: User[]) => {
        setUsers(users);
      },
      'update-players': (players: Player[]) => {
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
        negriCard,
        fields,
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
        negriCard: string | null;
        fields: CompletedField[];
      }) => {
        setPlayers(players);
        setGamePhase(gamePhase);
        setWhoseTurn(currentTurn);
        setCurrentField(currentField);
        setCurrentTrump(blowState.currentTrump);
        setCurrentHighestDeclaration(blowState.currentHighestDeclaration);
        setBlowDeclarations(blowState.declarations);
        setTeamScores(teamScores);
        setCurrentPlayerId(you);
        setNegriCard(negriCard);
        setCompletedFields(fields);
        setNegriPlayerId(negriPlayerId);
        setGameStarted(true);
      },
      'game-player-joined': (data: { playerId: string; roomId: string; isHost: boolean }) => {
        if (data.playerId === currentPlayerId) {
          setCurrentRoomId(data.roomId);
        }
        setPlayers((prev) => {
          const existingPlayer = prev.find(p => p.playerId === data.playerId);
          if (existingPlayer) {
            return prev;
          }
          
          const socketId = getSocket().id;
          if (!socketId) return prev;
          
          return [...prev, {
            id: socketId,
            playerId: data.playerId,
            name: data.playerId,
            team: 0,
            hand: [],
            isHost: data.isHost,
          }];
        });
      },
      'game-started': (roomId: string, players: Player[]) => {
        setPlayers(players);
        const id = getSocket().id;
        const index = players.findIndex(p => p.id === id);
        setCurrentPlayerId(players[index].playerId);
        setCurrentRoomId(roomId);
        setGameStarted(true);
      },
      'update-phase': ({ phase, scores, winner, currentHighestDeclaration }: { phase: GamePhase; scores: TeamScores; winner: number | null; currentHighestDeclaration: BlowDeclaration | null }) => {
        setGamePhase(phase);
        setTeamScores(scores);
        
        // Set current trump when transitioning to play phase
        if (phase === 'play' && currentHighestDeclaration) {
          setCurrentTrump(currentHighestDeclaration.trumpType);
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
      'broken': ({ nextPlayerId, players }: { nextPlayerId: string; players: Player[] }) => {
        setNotification({
          message: 'Broken happened, reset the game',
          type: 'warning'
        });
        setPlayers(players);
        setWhoseTurn(nextPlayerId);
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
        setRevealedAgari(agari);        
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
      'round-results': ({ scores }: {
        scores: { [key: number]: TeamScore };
      }) => {
        setTeamScores(scores as TeamScores);
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
        sessionStorage.setItem('reconnectToken', token);
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
        roomId: currentRoomId,
        declaration: {
          trumpType: selectedTrump,
          numberOfPairs,
        },
      });
    },
    passBlow: () => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn to pass!2");
        return;
      }
      getSocket().emit('pass-blow', {
        roomId: currentRoomId,
      });
    },
    selectNegri: (card: string) => {
      getSocket().emit('select-negri', {
        roomId: currentRoomId,
        card,
      });
    },
    playCard: (card: string) => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn!");
        return;
      }
      getSocket().emit('play-card', {
        roomId: currentRoomId,
        card,
      });
    },
    selectBaseSuit: (suit: string) => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn to select base suit!");
        return;
      }
      getSocket().emit('select-base-suit', {
        roomId: currentRoomId,
        suit,
      });
    },
    revealBrokenHand: (playerId: string) => {
      getSocket().emit('reveal-broken-hand', {
        roomId: currentRoomId,
        playerId,
      });
    }
  };

  if (!isClient) {
    return null;
  }

  return {
    name,
    setName,
    gameStarted,
    gamePhase,
    whoseTurn,
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
    notification,
    setNotification,
    currentRoomId,
    setCurrentRoomId,
    users,
  };
}; 