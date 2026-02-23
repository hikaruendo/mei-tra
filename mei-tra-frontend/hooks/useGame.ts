import { useState, useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { BlowDeclaration, CompletedField, Field, FieldCompleteEvent, GamePhase, Player, TeamScore, TeamScores, TrumpType, User } from '../types/game.types';
import { getTeamDisplayName } from '../lib/utils/teamUtils';

export const useGame = () => {
  const { socket, isConnected, isConnecting } = useSocket();
  const gameOverShownRef = useRef<string | null>(null);

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

  // Loading state details
  const [loadingState, setLoadingState] = useState<{
    isLoading: boolean;
    step: string;
  }>({
    isLoading: true,
    step: '認証状態を確認中...'
  });

  const [revealedAgari, setRevealedAgari] = useState<string | null>(null);
  const [currentField, setCurrentField] = useState<Field | null>(null);
  const [currentTrump, setCurrentTrump] = useState<TrumpType | null>(null);
  const [negriCard, setNegriCard] = useState<string | null>(null);
  const [negriPlayerId, setNegriPlayerId] = useState<string | null>(null);

  // Add state for completed fields
  const [completedFields, setCompletedFields] = useState<CompletedField[]>([]);

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [pointsToWin, setPointsToWin] = useState<number>(0);

  const [users, setUsers] = useState<User[]>([]);

  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Update loading state based on socket status - but don't block UI
    if (isConnecting) {
      setLoadingState({
        isLoading: false, // Don't block UI for socket connection
        step: 'サーバーに接続中...'
      });
    } else if (!socket) {
      setLoadingState({
        isLoading: false, // Don't block UI
        step: 'Socket接続を準備中...'
      });
    } else if (!isConnected) {
      setLoadingState({
        isLoading: false, // Don't block UI
        step: '接続を確立中...'
      });
    } else {
      setLoadingState({
        isLoading: false,
        step: '準備完了'
      });
    }

    if (!socket) return;

    const socketHandlers = {
      // ユーザーの更新
      'update-users': (users: User[]) => {
        setUsers(users);
      },
      'name-updated': ({ success, playerId, name, error }: { success: boolean; playerId?: string; name?: string; error?: string }) => {
        if (success && playerId && name) {
          setUsers((prev) => {
            const existingIndex = prev.findIndex((u) => u.id === socket?.id || u.playerId === playerId);
            const baseUser = {
              id: socket?.id ?? playerId,
              playerId,
              name,
              isAuthenticated: false,
            };

            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], ...baseUser };
              return updated;
            }

            return [...prev, baseUser];
          });
        } else if (!success && error) {
          setNotification({ message: error, type: 'error' });
        }
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
        roomId,
        pointsToWin,
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
        roomId: string;
        pointsToWin: number;
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
        setCurrentRoomId(roomId);
        setGameStarted(true);
        setPointsToWin(pointsToWin);
      },
      'game-player-joined': (data: { playerId: string; roomId: string; isHost: boolean; roomStatus?: string }) => {
        if (data.playerId === currentPlayerId) {
          setCurrentRoomId(data.roomId);
        }
        if (data.roomStatus === 'playing') {
          setGameStarted(true);
          // ゲーム中の場合、プレイヤー配列は'game-state'イベントで更新されるため、ここでは更新しない
          return;
        }
        setPlayers((prev) => {
          const existingPlayer = prev.find(p => p.playerId === data.playerId);
          if (existingPlayer) {
            return prev;
          }

          const socketId = socket?.id;
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
      'game-started': (roomId: string, players: Player[], pointsToWin: number) => {
        gameOverShownRef.current = null;
        resetBlowState({ preservePlayers: true });
        setPlayers(players);
        const id = socket?.id;
        const index = players.findIndex(p => p.id === id);
        setCurrentPlayerId(players[index].playerId);
        setCurrentRoomId(roomId);
        setPointsToWin(pointsToWin);
        setGameStarted(true);
        setGamePhase('blow');
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
      'error-message': (message: string) => {
        setNotification({ message, type: 'error' });
      },
      'update-turn': (playerId: string) => {
        setWhoseTurn(playerId);
      },
      'game-over': ({ winner, finalScores }: { winner: string; finalScores: TeamScores }) => {
        // Prevent showing alert multiple times for the same game
        const gameOverKey = `${winner}-${finalScores[0].total}-${finalScores[1].total}`;
        if (gameOverShownRef.current === gameOverKey) {
          return;
        }
        gameOverShownRef.current = gameOverKey;

        const team0Name = getTeamDisplayName(players, 0) || 'チーム 1';
        const team1Name = getTeamDisplayName(players, 1) || 'チーム 2';
        const winnerTeam = winner === 'Team 0' ? team0Name : team1Name;
        alert(`${winnerTeam} の勝利！\n\n最終スコア:\n${team0Name}: ${finalScores[0].total} ポイント\n${team1Name}: ${finalScores[1].total} ポイント`);
        setGameStarted(false);
        setGamePhase(null);
        setTeamScores({
          0: { deal: 0, blow: 0, play: 0, total: 0 },
          1: { deal: 0, blow: 0, play: 0, total: 0 }
        });

        // ゲーム終了後、古いroomIdでの再接続ループを防ぐ
        sessionStorage.removeItem('roomId');

        // Keep ref set until the next game starts (game-started handler clears it)
      },
      'blow-started': ({ startingPlayer, players }: { startingPlayer: string; players: Player[] }) => {
        setGamePhase('blow');
        setPlayers(players);
        setWhoseTurn(startingPlayer);
      },
      'blow-updated': ({ declarations, currentHighest }: { declarations: BlowDeclaration[]; currentHighest: BlowDeclaration | null }) => {
        setBlowDeclarations(declarations);
        setCurrentHighestDeclaration(currentHighest);
        // Note: Player state updates (including isPasser) are handled by 'update-players' event
        // This prevents race conditions and ensures consistency across all blow phase operations
      },
      'broken': ({ nextPlayerId, players, gamePhase }: { nextPlayerId: string; players: Player[]; gamePhase?: GamePhase }) => {
        setNotification({
          message: 'Broken happened, reset the game',
          type: 'warning'
        });
        resetBlowState({ preservePlayers: true });
        setPlayers(players);
        setWhoseTurn(nextPlayerId);
        setGamePhase(gamePhase ?? 'blow');
        setCurrentTrump(null);
      },
      // TODO: 実装
      // 'reveal-hands': ({ players }: { players: { playerId: string; hand: string[] }[] }) => {
      //   setPlayers(currentPlayers => 
      //     currentPlayers.map(p => {
      //       const revealedPlayer = players.find(rp => rp.playerId === p.playerId);
      //       return revealedPlayer ? { ...p, hand: revealedPlayer.hand } : p;
      //     })
      //   );
      // },
      'round-reset': () => {
        resetBlowState();
      },
      'round-cancelled': ({ nextDealer, players, currentTrump, currentHighestDeclaration, blowDeclarations }: { nextDealer: string; players: Player[]; currentTrump?: TrumpType | null; currentHighestDeclaration?: BlowDeclaration | null; blowDeclarations?: BlowDeclaration[] }) => {
        setNotification({
          message: 'Round cancelled! All players passed.',
          type: 'warning'
        });
        resetBlowState({ preservePlayers: true });
        setPlayers(players);
        setWhoseTurn(nextDealer);
        setCurrentTrump(currentTrump ?? null);
        setCurrentHighestDeclaration(currentHighestDeclaration ?? null);
        setBlowDeclarations(blowDeclarations ?? []);
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
      'back-to-lobby': () => {
        gameOverShownRef.current = null;
        setGameStarted(false);
        setGamePhase(null);
        setTeamScores({
          0: { deal: 0, blow: 0, play: 0, total: 0 },
          1: { deal: 0, blow: 0, play: 0, total: 0 }
        });
      },
      'game-paused': ({ message }: { message: string }) => {
        setPaused(true);
        setGameStarted(false);
        setNotification({ message, type: 'warning' });
      },
      'game-resumed': ({ message }: { message: string }) => {
        setPaused(false);
        setGameStarted(true);
        setNotification({ message, type: 'success' });
      },
      'player-converted-to-dummy': ({ playerId, message }: { playerId: string; message: string }) => {
        console.log('[useGame] Player converted to dummy:', playerId, message);
        setNotification({
          message: `プレイヤー ${playerId} が長時間切断のため、ダミープレイヤーに変換されました`,
          type: 'warning'
        });
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
  }, [socket, name, currentHighestDeclaration, players, isConnecting, isConnected, currentPlayerId, negriPlayerId]);

  const resetBlowState = (options?: { preservePlayers?: boolean }) => {
    setBlowDeclarations([]);
    setCurrentHighestDeclaration(null);
    setSelectedTrump(null);
    setNumberOfPairs(0);
    setNegriCard(null);
    setNegriPlayerId(null);
    setCurrentField(null);
    setCompletedFields([]);
    setRevealedAgari(null);
    if (!options?.preservePlayers) {
      setPlayers(prev => prev.map(player => ({ ...player, isPasser: false })));
    }
  };

  const gameActions = {
    declareBlow: () => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn to declare!");
        return;
      }
      if (!selectedTrump || numberOfPairs < 1) {
        alert('Please select a trump type and number of pairs!');
        return;
      }
      socket?.emit('declare-blow', {
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
      socket?.emit('pass-blow', {
        roomId: currentRoomId,
      });
    },
    selectNegri: (card: string) => {
      socket?.emit('select-negri', {
        roomId: currentRoomId,
        card,
      });
    },
    playCard: (card: string) => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn!");
        return;
      }
      socket?.emit('play-card', {
        roomId: currentRoomId,
        card,
      });
    },
    selectBaseSuit: (suit: string) => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        alert("It's not your turn to select base suit!");
        return;
      }
      socket?.emit('select-base-suit', {
        roomId: currentRoomId,
        suit,
      });
    },
    revealBrokenHand: (playerId: string) => {
      socket?.emit('reveal-broken-hand', {
        roomId: currentRoomId,
        playerId,
      });
    }
  };

  if (!isClient) {
    return {
      isLoading: true,
      loadingStep: 'クライアントを初期化中...',
      isConnected: false,
      isConnecting: false,
    };
  }

  // Return loading state information when still loading
  if (loadingState.isLoading) {
    return {
      isLoading: true,
      loadingStep: loadingState.step,
      isConnected,
      isConnecting,
    };
  }

  return {
    isLoading: false,
    loadingStep: loadingState.step,
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
    pointsToWin,
    users,
    paused,
    isConnected,
    isConnecting,
  };
}; 
