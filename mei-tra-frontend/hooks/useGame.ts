import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type {
  BackToLobbyPayload,
  BlowActionContract,
  BlowDeclarationContract,
  BlowUpdatedPayload,
  BlowStartedPayload,
  BrokenPayload,
  CardPlayedPayload,
  CompletedFieldContract,
  FieldCompletePayload,
  FieldContract,
  GameStartedPayload,
  GameOverPayload,
  GameStatePayload,
  NewRoundStartedPayload,
  PlayerContract,
  PlayCardPayload,
  PlaySetupCompletePayload,
  PlayerConvertedToComPayload,
  PlayerDisconnectedPayload,
  PlayerIdlePayload,
  PlayerLeftPayload,
  ReconnectionFailureCode,
  RequestAgariPayload,
  RevealAgariPayload,
  RoundCancelledPayload,
  RoundResultsPayload,
  SyncGameStatePayload,
  TransportGamePhase,
  TransportTeamScores,
  UpdatePhasePayload,
  UpdateTurnPayload,
} from '@contracts/game';
import type {
  GamePlayerJoinedPayload,
  RoomContract,
  RoomSyncPayload,
} from '@contracts/room';
import type { NameUpdatedPayload } from '@contracts/socket';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import {
  BlowAction,
  BlowDeclaration,
  CompletedField,
  ConnectionUser,
  Field,
  GamePhase,
  Player,
  Team,
  TeamNames,
  TeamScores,
  TrumpType,
  fromPlayerContracts,
} from '../types/game.types';
import { fromRoomContract, fromRoomSyncPayload } from '../types/room.types';
import { clearPlayerProfileCache } from '../lib/utils/profileUtils';
import { getTeamDisplayName } from '../lib/utils/teamLabels';
import {
  createEmptyGameEventState,
  createGameEventStateFromSnapshot,
  createGameEventStateFromStartedGame,
  reduceGameEvent,
  type GameEventState,
  type GameServerEvent,
} from '@meitra/game-client/game-event-reducer';
import { normalizePlayerIdentities } from '@meitra/game-client/identity';
import { resolveSelfPlayerId } from '../lib/utils/playerIdentity';

interface ProfileUpdatedPayload {
  userId: string;
}

const reconnectRecoveryMessageKeys: Record<
  ReconnectionFailureCode,
  | 'reconnectRecovery.roomUnavailable'
  | 'reconnectRecovery.sessionInvalid'
  | 'reconnectRecovery.stateInconsistent'
> = {
  roomUnavailable: 'reconnectRecovery.roomUnavailable',
  sessionInvalid: 'reconnectRecovery.sessionInvalid',
  stateInconsistent: 'reconnectRecovery.stateInconsistent',
};

const dedupeCompletedFields = (fields: CompletedField[]): CompletedField[] => {
  const seen = new Set<string>();

  return fields.filter((field) => {
    const signature = `${field.winnerSeatId}|${field.winnerTeam}|${field.cards.join(',')}`;
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
};

const createEmptyTeamScores = (): TeamScores => ({
  0: { deal: 0, blow: 0, play: 0, total: 0 },
  1: { deal: 0, blow: 0, play: 0, total: 0 },
});

const toUiGamePhase = (phase: TransportGamePhase): GamePhase =>
  phase === 'waiting' ? null : phase;

const toUiBlowDeclaration = (
  declaration: BlowDeclarationContract,
): BlowDeclaration => {
  const seatId = declaration.seatId;
  return { ...declaration, seatId };
};

const toUiBlowAction = (action: BlowActionContract): BlowAction => {
  const seatId = action.seatId;
  return { ...action, seatId };
};

const toUiField = (field: FieldContract | null): Field | null => {
  if (!field) {
    return null;
  }

  const dealerSeatId = field.dealerSeatId;
  const playedBySeatIds = [...field.playedBySeatIds];
  return {
    cards: field.cards,
    playedBySeatIds,
    baseCard: field.baseCard,
    baseSuit: field.baseSuit,
    dealerSeatId,
    isComplete: field.isComplete,
  };
};

const toUiCompletedField = (
  field: CompletedFieldContract,
): CompletedField => {
  const winnerSeatId = field.winnerSeatId;
  const dealerSeatId = field.dealerSeatId;
  return {
    cards: field.cards,
    winnerSeatId,
    winnerTeam: field.winnerTeam,
    dealerSeatId,
  };
};

const toUiCompletedFields = (
  fields: CompletedFieldContract[] | undefined,
): CompletedField[] =>
  dedupeCompletedFields((fields ?? []).map((field) => toUiCompletedField(field)));

const toUiTeamScores = (scores: TransportTeamScores): TeamScores => ({
  0: {
    deal: 0,
    blow: 0,
    play: scores[0]?.play ?? 0,
    total: scores[0]?.total ?? 0,
  },
  1: {
    deal: 0,
    blow: 0,
    play: scores[1]?.play ?? 0,
    total: scores[1]?.total ?? 0,
  },
});

const mergePlayersPreservingIdentity = (
  previousPlayers: Player[],
  nextPlayers: Player[],
): Player[] => {
  const previousByPlayerId = new Map(
    previousPlayers.map((player) => [player.seatId, player]),
  );

  return nextPlayers.map((nextPlayer) => {
    const previousPlayer = previousByPlayerId.get(nextPlayer.seatId);
    if (!previousPlayer || nextPlayer.isCOM) {
      return nextPlayer;
    }

    return {
      ...previousPlayer,
      ...nextPlayer,
      userId: nextPlayer.userId ?? previousPlayer.userId,
      isAuthenticated:
        nextPlayer.isAuthenticated ?? previousPlayer.isAuthenticated,
      isHost: nextPlayer.isHost ?? previousPlayer.isHost,
      name: nextPlayer.name || previousPlayer.name,
    };
  });
};

export const useGame = () => {
  const tStatus = useTranslations('playerStatus');
  const t = useTranslations('game');
  const { socket, isConnected, isConnecting } = useSocket();
  const { user } = useAuth();
  const gameOverShownRef = useRef<string | null>(null);
  const gameEventStateRef = useRef(createEmptyGameEventState());
  const agariRequestKeyRef = useRef<string | null>(null);
  const roomBootstrapRef = useRef<string | null>(null);
  const gameStateSyncKeyRef = useRef<string | null>(null);
  const legacyRoomEventSkipRef = useRef<{
    roomId: string | null;
    roomUpdated: boolean;
    updatePlayers: boolean;
  }>({
    roomId: null,
    roomUpdated: false,
    updatePlayers: false,
  });

  // Player and Game State
  const [name, setName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>(null);
  const [whoseTurn, setWhoseTurn] = useState<string | null>(null);
  const [teamScores, setTeamScores] = useState<TeamScores>(createEmptyTeamScores);
  // Blow Phase State
  const [blowDeclarations, setBlowDeclarations] = useState<BlowDeclaration[]>([]);
  const [blowActionHistory, setBlowActionHistory] = useState<BlowAction[]>([]);
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
  const [gameOverModal, setGameOverModal] = useState<{ title: string; message: string } | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentHostId, setCurrentHostId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [pointsToWin, setPointsToWin] = useState<number>(0);
  const [teamNames, setTeamNames] = useState<TeamNames | undefined>();
  const [idlePlayerIds, setIdlePlayerIds] = useState<string[]>([]);
  const [disconnectedPlayerIds, setDisconnectedPlayerIds] = useState<string[]>([]);

  const [users, setUsers] = useState<ConnectionUser[]>([]);
  // Keep a ref to users so event handlers always see the latest value (avoids stale closure)
  const usersRef = useRef<ConnectionUser[]>([]);
  const playersRef = useRef<Player[]>([]);

  const [paused, setPaused] = useState(false);

  const resetRoomState = useCallback(() => {
    gameEventStateRef.current = createEmptyGameEventState();
    gameOverShownRef.current = null;
    agariRequestKeyRef.current = null;
    roomBootstrapRef.current = null;
    gameStateSyncKeyRef.current = null;
    setGameStarted(false);
    setGamePhase(null);
    setCurrentRoomId(null);
    setCurrentHostId(null);
    setCurrentPlayerId(null);
    setIsHost(false);
    setIsSpectator(false);
    setIdlePlayerIds([]);
    setDisconnectedPlayerIds([]);
    playersRef.current = [];
    setPlayers([]);
    setTeamScores(createEmptyTeamScores());
    setTeamNames(undefined);
    setCurrentField(null);
    setCompletedFields([]);
    setCurrentTrump(null);
    setWhoseTurn(null);
    setBlowDeclarations([]);
    setBlowActionHistory([]);
    setCurrentHighestDeclaration(null);
    setRevealedAgari(null);
    setNegriCard(null);
    setNegriPlayerId(null);
    setPointsToWin(0);
    setPaused(false);
    sessionStorage.removeItem('roomId');
  }, []);

  const getTeamLabel = useCallback(
    (team: Team) =>
      getTeamDisplayName(team, teamNames, (fallbackTeam) =>
        t(fallbackTeam === 0 ? 'teamRed' : 'teamBlack'),
      ),
    [teamNames, t],
  );

  const syncDisconnectedPlayerIdsFromPlayers = useCallback(
    (nextPlayers: Array<Pick<Player, 'seatId' | 'isCOM' | 'socketId'>>) => {
      setDisconnectedPlayerIds(
        nextPlayers
          .filter((player) => !player.isCOM && !player.socketId)
          .map((player) => player.seatId),
      );
    },
    [],
  );

  const resolveCurrentUserPlayerId = useCallback(<T extends { seatId: string; userId?: string }>(
    nextPlayers: T[],
    fallbackPlayerId?: string | null,
    serverPlayerId?: string | null,
  ): string | null => {
    return resolveSelfPlayerId(nextPlayers, {
      userId: user?.id,
      serverPlayerId,
      fallbackPlayerId,
    });
  }, [user?.id]);

  const syncCurrentPlayerIdentity = useCallback((
    nextPlayers: Player[],
    fallbackPlayerId?: string | null,
    serverPlayerId?: string | null,
  ) => {
    const nextCurrentPlayerId = resolveCurrentUserPlayerId(
      nextPlayers,
      fallbackPlayerId,
      serverPlayerId,
    );
    if (nextCurrentPlayerId) {
      setCurrentPlayerId(nextCurrentPlayerId);
    }
  }, [resolveCurrentUserPlayerId]);

  const getCurrentUserPlayerId = useCallback(
    () => resolveCurrentUserPlayerId(playersRef.current, currentPlayerId),
    [currentPlayerId, resolveCurrentUserPlayerId],
  );

  const hasPlayerActedInCurrentBlow = useCallback(
    (playerId: string): boolean => {
      const player = playersRef.current.find(
        (candidate) => candidate.seatId === playerId,
      );

      return (
        Boolean(player?.isPasser) ||
        blowDeclarations.some(
          (declaration) => declaration.seatId === playerId,
        ) ||
        blowActionHistory.some((action) => action.seatId === playerId)
      );
    },
    [blowActionHistory, blowDeclarations],
  );

  const updatePlayersLocally = useCallback((
    updater: (previousPlayers: Player[]) => Player[],
  ) => {
    setPlayers((previousPlayers) => {
      const nextPlayers = updater(previousPlayers);
      playersRef.current = nextPlayers;
      return nextPlayers;
    });
  }, []);

  const commitPlayers = useCallback((nextPlayers: Player[]) => {
    playersRef.current = nextPlayers;
    setPlayers(nextPlayers);
  }, []);

  const resetBlowState = useCallback((options?: { preservePlayers?: boolean }) => {
    setBlowDeclarations([]);
    setBlowActionHistory([]);
    setCurrentHighestDeclaration(null);
    setSelectedTrump(null);
    setNumberOfPairs(0);
    setNegriCard(null);
    setNegriPlayerId(null);
    setCurrentField(null);
    setCompletedFields([]);
    setRevealedAgari(null);
    if (!options?.preservePlayers) {
      updatePlayersLocally((prev) =>
        prev.map((player) => ({ ...player, isPasser: false })),
      );
    }
  }, [updatePlayersLocally]);

  const markRoomSyncHandled = useCallback((roomId: string) => {
    legacyRoomEventSkipRef.current = {
      roomId,
      roomUpdated: true,
      updatePlayers: true,
    };
  }, []);

  const shouldSkipLegacyRoomUpdated = useCallback((roomId: string) => {
    const state = legacyRoomEventSkipRef.current;
    if (state.roomId !== roomId || !state.roomUpdated) {
      return false;
    }

    state.roomUpdated = false;
    if (!state.updatePlayers) {
      state.roomId = null;
    }
    return true;
  }, []);

  const shouldSkipLegacyUpdatePlayers = useCallback((roomId: string | null) => {
    const state = legacyRoomEventSkipRef.current;
    if (!state.updatePlayers) {
      return false;
    }
    if (roomId && state.roomId && state.roomId !== roomId) {
      return false;
    }

    state.updatePlayers = false;
    if (!state.roomUpdated) {
      state.roomId = null;
    }
    return true;
  }, []);

  useEffect(() => {
    if (!currentHostId || !currentPlayerId) {
      setIsHost(false);
      return;
    }

    setIsHost(currentHostId === currentPlayerId);
  }, [currentHostId, currentPlayerId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user || !socket?.connected || currentRoomId) {
      return;
    }

    const storedRoomId = sessionStorage.getItem('roomId');
    if (!storedRoomId || roomBootstrapRef.current === storedRoomId) {
      return;
    }

    roomBootstrapRef.current = storedRoomId;

    console.log('[useGame] Syncing room state from stored roomId:', storedRoomId);
    socket.emit('sync-game-state', { roomId: storedRoomId });
  }, [currentRoomId, socket, user]);

  useEffect(() => {
    if (currentRoomId) {
      roomBootstrapRef.current = null;
    }
  }, [currentRoomId]);

  useEffect(() => {
    if (
      !socket?.connected ||
      !currentRoomId ||
      gamePhase !== 'play' ||
      !currentPlayerId ||
      currentHighestDeclaration?.seatId !== currentPlayerId ||
      revealedAgari ||
      negriCard
    ) {
      if (gamePhase !== 'play') {
        agariRequestKeyRef.current = null;
      }
      return;
    }

    const requestKey = [
      currentRoomId,
      socket.id,
      currentPlayerId,
      currentHighestDeclaration.trumpType,
      currentHighestDeclaration.numberOfPairs,
      currentHighestDeclaration.timestamp,
    ].join(':');
    if (agariRequestKeyRef.current === requestKey) {
      return;
    }

    agariRequestKeyRef.current = requestKey;
    const payload: RequestAgariPayload = { roomId: currentRoomId };
    socket.emit('request-agari', payload);
  }, [
    currentHighestDeclaration,
    currentPlayerId,
    currentRoomId,
    gamePhase,
    negriCard,
    revealedAgari,
    socket,
  ]);

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

    const commitGameEventState = (
      previous: GameEventState,
      next: GameEventState,
    ) => {
      if (next.players !== previous.players) {
        const nextPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          fromPlayerContracts(next.players),
        );
        commitPlayers(nextPlayers);
        syncDisconnectedPlayerIdsFromPlayers(nextPlayers);
        setIdlePlayerIds((idleIds) =>
          idleIds.filter((playerId) =>
            nextPlayers.some((player) => player.seatId === playerId),
          ),
        );
        if (!isSpectator) {
          syncCurrentPlayerIdentity(nextPlayers, currentPlayerId);
        }
      }

      setGamePhase(toUiGamePhase(next.gamePhase));
      setWhoseTurn(next.currentTurnSeatId);
      setCurrentField(toUiField(next.currentField));
      setCurrentTrump(next.blowState.currentTrump);
      setCurrentHighestDeclaration(
        next.blowState.currentHighestDeclaration
          ? toUiBlowDeclaration(next.blowState.currentHighestDeclaration)
          : null,
      );
      setBlowDeclarations(
        next.blowState.declarations.map(toUiBlowDeclaration),
      );
      setBlowActionHistory(
        (next.blowState.actionHistory ?? []).map(toUiBlowAction),
      );
      setTeamScores(toUiTeamScores(next.teamScores));
      setNegriCard(next.negriCard);
      setNegriPlayerId(next.negriSeatId);
      setRevealedAgari(next.revealedAgari);
      setCompletedFields(toUiCompletedFields(next.fields));
    };

    const applyGameServerEvent = (event: GameServerEvent) => {
      const previous = gameEventStateRef.current;
      const next = reduceGameEvent(previous, event, {
        selfSeatId: getCurrentUserPlayerId(),
      });
      gameEventStateRef.current = next;
      commitGameEventState(previous, next);
      return next;
    };

    const socketHandlers = {
      // ユーザーの更新
      'update-users': (users: ConnectionUser[]) => {
        usersRef.current = users;
        setUsers(users);
      },
      'name-updated': (payload: NameUpdatedPayload) => {
        if (payload.success && payload.seatId) {
          const { seatId, name } = payload;
          setUsers((prev) => {
            const existingIndex = prev.findIndex((u) => u.seatId === seatId);
            const baseUser = {
              socketId: '',
              seatId,
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
        } else if (!payload.success) {
          setNotification({ message: payload.error, type: 'error' });
        }
      },
      'update-players': (playerContracts: PlayerContract[]) => {
        if (shouldSkipLegacyUpdatePlayers(currentRoomId)) {
          return;
        }
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          players: normalizePlayerIdentities(playerContracts),
        };
        const nextPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          fromPlayerContracts(playerContracts),
        );
        commitPlayers(nextPlayers);
        syncDisconnectedPlayerIdsFromPlayers(nextPlayers);
        setIdlePlayerIds((prev) =>
          prev.filter((playerId) =>
            nextPlayers.some((player) => player.seatId === playerId),
          ),
        );
        syncCurrentPlayerIdentity(nextPlayers, currentPlayerId);
      },
      'set-room-id': (roomId: string) => {
        setCurrentRoomId(roomId);
      },
      'room-updated': (room: RoomContract) => {
        const nextRoom = fromRoomContract(room);
        if (shouldSkipLegacyRoomUpdated(nextRoom.id)) {
          return;
        }
        const selfPlayerId = resolveCurrentUserPlayerId(
          nextRoom.players,
          currentPlayerId,
        );
        const isCurrentRoom =
          nextRoom.id === currentRoomId ||
          Boolean(
            selfPlayerId &&
              nextRoom.players.some(
                (player) => player.seatId === selfPlayerId,
              ),
          );

        if (!isCurrentRoom) {
          return;
        }

        if (!currentRoomId) {
          setCurrentRoomId(nextRoom.id);
        }

        setCurrentHostId(nextRoom.hostSeatId);
        setTeamNames(nextRoom.settings.teamNames);
        if (selfPlayerId) {
          setCurrentPlayerId(selfPlayerId);
        }
      },
      'room-sync': (payload: RoomSyncPayload) => {
        const { room: nextRoom, players: nextPlayers } =
          fromRoomSyncPayload(payload);
        markRoomSyncHandled(nextRoom.id);
        const selfPlayerId = resolveCurrentUserPlayerId(
          nextRoom.players,
          currentPlayerId,
        );
        const isCurrentRoom =
          nextRoom.id === currentRoomId ||
          Boolean(
            selfPlayerId &&
              nextRoom.players.some(
                (player) => player.seatId === selfPlayerId,
              ),
          );

        if (!isCurrentRoom) {
          return;
        }

        const mergedPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          nextPlayers,
        );
        commitPlayers(mergedPlayers);
        syncDisconnectedPlayerIdsFromPlayers(mergedPlayers);
        syncCurrentPlayerIdentity(mergedPlayers, selfPlayerId);

        if (!currentRoomId) {
          setCurrentRoomId(nextRoom.id);
        }

        setCurrentHostId(nextRoom.hostSeatId);
        setTeamNames(nextRoom.settings.teamNames);
        if (selfPlayerId) {
          setCurrentPlayerId(selfPlayerId);
        }
      },
      'game-state': ({
        players: playerContracts,
        gamePhase,
        currentField,
        currentTurnSeatId,
        blowState,
        teamScores,
        youSeatId,
        negriCard,
        negriSeatId,
        revealedAgari: syncedRevealedAgari,
        fields,
        roomId,
        hostSeatId,
        pointsToWin,
        teamNames,
        isSpectator,
      }: GameStatePayload) => {
        gameEventStateRef.current = createGameEventStateFromSnapshot({
          players: playerContracts,
          gamePhase,
          currentField,
          currentTurnSeatId,
          blowState,
          teamScores,
          youSeatId,
          negriCard,
          negriSeatId,
          revealedAgari: syncedRevealedAgari,
          fields,
          roomId,
          hostSeatId,
          pointsToWin,
          teamNames,
          isSpectator,
        });
        const nextPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          fromPlayerContracts(playerContracts),
        );
        commitPlayers(nextPlayers);
        syncDisconnectedPlayerIdsFromPlayers(nextPlayers);
        if (!isSpectator) {
          syncCurrentPlayerIdentity(nextPlayers, currentPlayerId, youSeatId);
        }
        setGamePhase(toUiGamePhase(gamePhase));
        setRevealedAgari(syncedRevealedAgari ?? null);
        setWhoseTurn(currentTurnSeatId);
        setCurrentField(toUiField(currentField));
        setCurrentTrump(blowState.currentTrump);
        setCurrentHighestDeclaration(
          blowState.currentHighestDeclaration
            ? toUiBlowDeclaration(blowState.currentHighestDeclaration)
            : null,
        );
        setBlowDeclarations(blowState.declarations.map(toUiBlowDeclaration));
        setBlowActionHistory(
          (blowState.actionHistory ?? []).map(toUiBlowAction),
        );
        setTeamScores(toUiTeamScores(teamScores));
        setIsSpectator(Boolean(isSpectator));
        setNegriCard(negriCard);
        setCompletedFields(toUiCompletedFields(fields));
        setNegriPlayerId(negriSeatId);
        setCurrentRoomId(roomId);
        setCurrentHostId(hostSeatId);
        if (isSpectator) {
          setIsHost(false);
        }
        setGameStarted(true);
        setPointsToWin(pointsToWin);
        setTeamNames(teamNames);
        setIdlePlayerIds((prev) =>
          prev.filter((playerId) =>
            nextPlayers.some((player) => player.seatId === playerId),
          ),
        );
      },
      'game-player-joined': (data: GamePlayerJoinedPayload) => {
        const joinedSeatId = data.seatId;
        // isSelf: true means the backend confirmed "this is YOUR player ID".
        // Only set currentPlayerId from this explicit self-identification event.
        if (data.isSelf) {
          setCurrentPlayerId(joinedSeatId);
          setCurrentRoomId(data.roomId);
          setIsHost(data.isHost);
        }

        if (joinedSeatId === currentPlayerId) {
          setCurrentRoomId(data.roomId);
          setIsHost(data.isHost);
        }
        if (data.roomStatus === 'playing') {
          setGameStarted(true);
          // ゲーム中の場合、プレイヤー配列は'game-state'イベントで更新されるため、ここでは更新しない
          return;
        }
        updatePlayersLocally((prev) => {
          const existingPlayer = prev.find(p => p.seatId === joinedSeatId);
          if (existingPlayer) {
            return prev;
          }

          // Look up display name from users list by playerId (not socket.id).
          // Use usersRef.current to avoid stale closure — users state may be empty at handler registration time.
          const knownUser = usersRef.current.find(u => u.seatId === joinedSeatId);

          return [...prev, {
            socketId: knownUser?.socketId ?? '',
            seatId: joinedSeatId,
            name: data.name || knownUser?.name || joinedSeatId,
            team: (data.team ?? 0) as Player['team'],
            hand: [],
            isHost: data.isHost,
          }];
        });
      },
      'profile-updated': ({ userId }: ProfileUpdatedPayload) => {
        if (!userId) {
          return;
        }

        clearPlayerProfileCache(userId);
        const profileRevision = Date.now();

        updatePlayersLocally((prev) =>
          prev.map((player) =>
            player.userId === userId || player.seatId === userId
              ? { ...player, profileRevision }
              : player,
          ),
        );
      },
      'game-started': ({
        roomId,
        players: playerContracts,
        pointsToWin,
        teamNames,
      }: GameStartedPayload) => {
        gameEventStateRef.current = createGameEventStateFromStartedGame({
          roomId,
          players: playerContracts,
          pointsToWin,
          teamNames,
        });
        const nextPlayers = mergePlayersPreservingIdentity(
          playersRef.current,
          fromPlayerContracts(playerContracts),
        );
        gameOverShownRef.current = null;
        resetBlowState({ preservePlayers: true });
        commitPlayers(nextPlayers);
        syncDisconnectedPlayerIdsFromPlayers(nextPlayers);
        const selfPlayerId = resolveCurrentUserPlayerId(
          nextPlayers,
          currentPlayerId,
        );
        if (selfPlayerId) {
          setCurrentPlayerId(selfPlayerId);
        } else if (currentPlayerId) {
          console.error('[useGame] Player not found in game-started', {
            currentPlayerId,
            userId: user?.id,
          });
        }

        setCurrentRoomId(roomId);
        setPointsToWin(pointsToWin);
        setTeamNames(teamNames);
        setGameStarted(true);
        setGamePhase('blow');
      },
      'update-phase': ({
        phase,
        scores,
        winner,
        currentHighestDeclaration,
      }: UpdatePhasePayload) => {
        applyGameServerEvent({
          type: 'update-phase',
          payload: { phase, scores, winner, currentHighestDeclaration },
        });
        const nextPhase = toUiGamePhase(phase);

        // Only show alert for phases other than 'play' and when not transitioning to a new round
        if (winner !== null && nextPhase !== 'play' && nextPhase !== 'blow') {
          setNotification({
            message: t('phaseResult', {
              teamName: getTeamLabel(winner),
              phase: t(`phaseNames.${nextPhase}` as 'phaseNames.deal'),
            }),
            type: 'success',
          });
        }
      },
      'error-message': (message: string) => {
        setNotification({ message, type: 'error' });
      },
      'update-turn': (playerId: UpdateTurnPayload) => {
        applyGameServerEvent({ type: 'update-turn', payload: playerId });
        if (socket && currentRoomId && !isSpectator) {
          socket.emit('turn-ack', { roomId: currentRoomId });
        }
      },
      'game-over': ({ winner, finalScores }: GameOverPayload) => {
        // Prevent showing alert multiple times for the same game
        const gameOverKey = `${winner}-${finalScores[0].total}-${finalScores[1].total}`;
        if (gameOverShownRef.current === gameOverKey) {
          return;
        }
        gameOverShownRef.current = gameOverKey;

        const teamRedName = getTeamLabel(0);
        const teamBlackName = getTeamLabel(1);
        const winnerTeam = winner === 'Team 0' ? teamRedName : teamBlackName;
        setGameOverModal({
          title: t('gameOver.title'),
          message: t('gameOver.message', {
            winnerTeam,
            teamRedName,
            team0Score: finalScores[0]?.total ?? 0,
            teamBlackName,
            team1Score: finalScores[1]?.total ?? 0,
          }),
        });
        setGameStarted(false);
        setGamePhase(null);
        setTeamScores(createEmptyTeamScores());

        // ゲーム終了後、古いroomIdでの再接続ループを防ぐ
        sessionStorage.removeItem('roomId');

        // Keep ref set until the next game starts (game-started handler clears it)
      },
      'blow-started': (payload: BlowStartedPayload) => {
        applyGameServerEvent({ type: 'blow-started', payload });
      },
      'blow-updated': (payload: BlowUpdatedPayload) => {
        applyGameServerEvent({ type: 'blow-updated', payload });
      },
      'broken': (payload: BrokenPayload) => {
        setNotification({
          message: 'Broken happened, reset the game',
          type: 'warning'
        });
        applyGameServerEvent({ type: 'broken', payload });
      },
      // TODO: 実装
      // 'reveal-hands': ({ players }: { players: { playerId: string; hand: string[] }[] }) => {
      //   setPlayers(currentPlayers => 
      //     currentPlayers.map(p => {
      //       const revealedPlayer = players.find(rp => rp.seatId === p.seatId);
      //       return revealedPlayer ? { ...p, hand: revealedPlayer.hand } : p;
      //     })
      //   );
      // },
      'round-reset': () => {
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          blowState: createEmptyGameEventState().blowState,
          currentField: null,
          fields: [],
          negriCard: null,
          negriSeatId: null,
          revealedAgari: null,
        };
        resetBlowState();
      },
      'round-cancelled': (payload: RoundCancelledPayload) => {
        setNotification({
          message: 'Round cancelled! All players passed.',
          type: 'warning'
        });
        applyGameServerEvent({ type: 'round-cancelled', payload });
      },
      'reveal-agari': (payload: RevealAgariPayload) => {
        applyGameServerEvent({ type: 'reveal-agari', payload });
        setNotification({
          message: payload.message,
          type: 'success'
        });
      },
      'play-setup-complete': (payload: PlaySetupCompletePayload) => {
        applyGameServerEvent({ type: 'play-setup-complete', payload });
      },
      'card-played': (payload: CardPlayedPayload) => {
        applyGameServerEvent({ type: 'card-played', payload });
      },
      'field-updated': (field: FieldContract) => {
        applyGameServerEvent({ type: 'field-updated', payload: field });
      },
      'field-complete': (payload: FieldCompletePayload) => {
        applyGameServerEvent({ type: 'field-complete', payload });
      },
      'round-results': (payload: RoundResultsPayload) => {
        applyGameServerEvent({ type: 'round-results', payload });
      },
      'new-round-started': (payload: NewRoundStartedPayload) => {
        applyGameServerEvent({ type: 'new-round-started', payload });
      },
      'back-to-lobby': (payload?: BackToLobbyPayload) => {
        console.warn('[useGame] back-to-lobby received', {
          currentRoomId,
          currentPlayerId,
          storedRoomId:
            typeof window !== 'undefined'
              ? sessionStorage.getItem('roomId')
              : null,
        });
        resetRoomState();
        if (payload?.code) {
          setNotification({
            message: t(reconnectRecoveryMessageKeys[payload.code]),
            type: 'warning',
          });
        }
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
      'player-disconnected': ({
        seatId,
        playerName,
      }: PlayerDisconnectedPayload) => {
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          players: gameEventStateRef.current.players.map((player) =>
            player.seatId === seatId
              ? {
                  ...player,
                  socketId: '',
                  name: playerName ?? player.name,
                }
              : player,
          ),
        };
        updatePlayersLocally((prev) =>
          prev.map((player) =>
            player.seatId === seatId
              ? {
                  ...player,
                  socketId: '',
                  name: playerName ?? player.name,
                }
              : player,
          ),
        );
        setIdlePlayerIds((prev) => prev.filter((id) => id !== seatId));
        setDisconnectedPlayerIds((prev) =>
          prev.includes(seatId) ? prev : [...prev, seatId],
        );
        setNotification({
          message: tStatus('disconnectedNotice', {
            playerName: playerName ?? seatId,
          }),
          type: 'warning'
        });
      },
      'player-idle': ({
        seatId,
        playerName,
      }: PlayerIdlePayload) => {
        setIdlePlayerIds((prev) =>
          prev.includes(seatId) ? prev : [...prev, seatId],
        );
        setNotification({
          message: tStatus('idleNotice', {
            playerName: playerName ?? seatId,
          }),
          type: 'warning',
        });
      },
      'player-idle-cleared': ({ seatId }: PlayerIdlePayload) => {
        setIdlePlayerIds((prev) => prev.filter((id) => id !== seatId));
      },
      'player-converted-to-com': ({
        seatId,
        playerName,
        message,
      }: PlayerConvertedToComPayload) => {
        console.log('[useGame] Player converted to COM:', seatId, message);
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          players: gameEventStateRef.current.players.map((player) =>
            player.seatId === seatId
              ? { ...player, isCOM: true, socketId: '' }
              : player,
          ),
        };
        setIdlePlayerIds((prev) => prev.filter((id) => id !== seatId));
        setDisconnectedPlayerIds((prev) => prev.filter((id) => id !== seatId));
        if (seatId === currentPlayerId) {
          resetRoomState();
          setNotification({
            message: tStatus('convertedToComNotice', {
              playerName: playerName ?? seatId,
            }),
            type: 'warning'
          });
          return;
        }
        setNotification({
          message: tStatus('convertedToComNotice', {
            playerName: playerName ?? seatId,
          }),
          type: 'warning'
        });
      },
      'player-left': ({ seatId }: PlayerLeftPayload) => {
        setIdlePlayerIds((prev) => prev.filter((id) => id !== seatId));
        setDisconnectedPlayerIds((prev) => prev.filter((id) => id !== seatId));
        if (seatId === currentPlayerId) {
          setCurrentRoomId(null);
          setIsHost(false);
        }
      },
      'turn-ping': ({ roomId }: { roomId: string }) => {
        if (!isSpectator) {
          socket.emit('turn-ack', { roomId });
        }
      },
    };

    // Register all socket handlers
    Object.entries(socketHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    const storedRoomId =
      typeof window === 'undefined'
        ? null
        : sessionStorage.getItem('roomId');
    const gameStateSyncKey =
      socket.connected && socket.id && storedRoomId
        ? `${socket.id}:${storedRoomId}`
        : null;

    if (
      gameStateSyncKey &&
      gameStateSyncKeyRef.current !== gameStateSyncKey
    ) {
      gameStateSyncKeyRef.current = gameStateSyncKey;
      const payload: SyncGameStatePayload = {
        roomId: storedRoomId ?? undefined,
      };
      socket.emit('sync-game-state', payload);
    }

    // Cleanup socket handlers
    return () => {
      Object.keys(socketHandlers).forEach((event) => {
        socket.off(event, socketHandlers[event as keyof typeof socketHandlers]);
      });
    };
  }, [
    socket,
    name,
    currentHighestDeclaration,
    players,
    isConnecting,
    isConnected,
    currentPlayerId,
    currentRoomId,
    isSpectator,
    negriPlayerId,
    markRoomSyncHandled,
    commitPlayers,
    resolveCurrentUserPlayerId,
    getCurrentUserPlayerId,
    updatePlayersLocally,
    syncCurrentPlayerIdentity,
    shouldSkipLegacyRoomUpdated,
    shouldSkipLegacyUpdatePlayers,
    resetRoomState,
    resetBlowState,
    syncDisconnectedPlayerIdsFromPlayers,
    getTeamLabel,
    t,
    tStatus,
    user?.id,
  ]);

  const startGame = () => {
    const selfPlayerId = getCurrentUserPlayerId();
    if (!currentRoomId || !selfPlayerId) return;
    socket?.emit('start-game', { roomId: currentRoomId, playerId: selfPlayerId });
  };

  const removePlayerFromRoom = (targetPlayerId: string) => {
    const selfPlayerId = getCurrentUserPlayerId();
    if (!socket || !currentRoomId || !selfPlayerId) return;
    socket.emit('moderate-player', {
      roomId: currentRoomId,
      requesterPlayerId: selfPlayerId,
      targetSeatId: targetPlayerId,
      targetPlayerId,
      action: 'remove',
    });
  };

  const replacePlayerWithCOM = (targetPlayerId: string) => {
    const selfPlayerId = getCurrentUserPlayerId();
    if (!socket || !currentRoomId || !selfPlayerId) return;
    socket.emit('moderate-player', {
      roomId: currentRoomId,
      requesterPlayerId: selfPlayerId,
      targetSeatId: targetPlayerId,
      targetPlayerId,
      action: 'replace-with-com',
    });
  };

  const shuffleTeams = () => {
    const selfPlayerId = getCurrentUserPlayerId();
    if (!socket || !currentRoomId || !selfPlayerId) return;
    socket.emit('shuffle-teams', {
      roomId: currentRoomId,
      playerId: selfPlayerId,
    });
  };

  const updateTeamNames = (nextTeamNames: TeamNames) => {
    const selfPlayerId = getCurrentUserPlayerId();
    if (!socket || !currentRoomId || !selfPlayerId) return;
    socket.emit('update-team-names', {
      roomId: currentRoomId,
      playerId: selfPlayerId,
      teamNames: nextTeamNames,
    });
  };

  const gameActions = {
    declareBlow: () => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        setNotification({ message: t('errors.notYourTurnDeclare'), type: 'error' });
        return;
      }
      if (hasPlayerActedInCurrentBlow(currentPlayerId)) {
        setNotification({ message: t('errors.alreadyActedInBlow'), type: 'error' });
        return;
      }
      if (!selectedTrump || numberOfPairs < 1) {
        setNotification({ message: t('errors.selectTrumpAndPairs'), type: 'error' });
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
        setNotification({ message: t('errors.notYourTurnPass'), type: 'error' });
        return;
      }
      if (hasPlayerActedInCurrentBlow(currentPlayerId)) {
        setNotification({ message: t('errors.alreadyActedInBlow'), type: 'error' });
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
        setNotification({ message: t('errors.notYourTurnPlay'), type: 'error' });
        return;
      }
      if (!currentRoomId) {
        return;
      }
      const payload: PlayCardPayload = {
        roomId: currentRoomId,
        card,
      };
      socket?.emit('play-card', payload);
    },
    selectBaseSuit: (suit: string) => {
      if (!currentPlayerId || whoseTurn !== currentPlayerId) {
        setNotification({ message: t('errors.notYourTurnBaseSuit'), type: 'error' });
        return;
      }
      socket?.emit('select-base-suit', {
        roomId: currentRoomId,
        suit,
      });
    },
    revealBrokenHand: (playerId: string) => {
      const selfPlayerId = getCurrentUserPlayerId();
      if (!selfPlayerId || playerId !== selfPlayerId) {
        return;
      }
      socket?.emit('reveal-broken-hand', {
        roomId: currentRoomId,
        targetSeatId: selfPlayerId,
        playerId: selfPlayerId,
      });
    }
  };

  const closeGameOverModal = () => {
    setGameOverModal(null);
  };

  if (!isClient) {
    return {
      isLoading: true,
      loadingStep: 'クライアントを初期化中...',
      socket,
      isConnected: false,
      isConnecting: false,
      gameOverModal: null,
      closeGameOverModal: () => {},
    };
  }

  // Return loading state information when still loading
  if (loadingState.isLoading) {
    return {
      isLoading: true,
      loadingStep: loadingState.step,
      socket,
      isConnected,
      isConnecting,
      gameOverModal: null,
      closeGameOverModal: () => {},
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
    blowActionHistory,
    currentHighestDeclaration,
    selectedTrump,
    setSelectedTrump,
    numberOfPairs,
    setNumberOfPairs,
    teamScores,
    currentPlayerId,
    notification,
    setNotification,
    gameOverModal,
    closeGameOverModal,
    currentRoomId,
    isHost,
    isSpectator,
    teamNames,
    startGame,
    shuffleTeams,
    updateTeamNames,
    removePlayerFromRoom,
    replacePlayerWithCOM,
    idlePlayerIds,
    disconnectedPlayerIds,
    pointsToWin,
    users,
    paused,
    socket,
    isConnected,
    isConnecting,
  };
}; 
