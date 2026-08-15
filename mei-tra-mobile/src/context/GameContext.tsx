import type {
  PlayerContract,
  ReconnectionFailureCode,
  TeamNames,
  TrumpType,
} from '@meitra/contracts/game';
import type {
  AckableClientEvent,
  ChangePlayerTeamPayload,
  ClientAckPayloads,
  JoinRoomPayload,
  ModeratePlayerPayload,
  RoomActionPayload,
} from '@meitra/contracts/socket';
import type { RoomContract } from '@meitra/contracts/room';
import { asSeatId } from '@meitra/contracts/ids';
import { io } from 'socket.io-client';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import {
  normalizePlayerIdentities,
  normalizeRoomIdentity,
} from '@meitra/game-client/identity';
import {
  createEmptyGameEventState,
  createGameEventStateFromSnapshot,
  createGameEventStateFromStartedGame,
  reduceGameEvent,
  type GameEventState,
  type GameServerEvent,
} from '@meitra/game-client/game-event-reducer';

import { useAuth } from '@/context/AuthContext';
import { config } from '@/lib/config';
import {
  createEmptyBlowState,
  createStartedGameSnapshot,
  extractDisconnectedPlayerIds,
  mergePlayersByIdentity,
  normalizeGameStatePayload,
  resolvePlayerId,
  shouldAckTurn,
} from '@/lib/game-state';
import {
  emitWithAck as emitSocketWithAck,
  type MobileSocket,
} from '@/lib/realtime';
import { roomStorage } from '@/lib/room-storage';
import type {
  ConnectionStatus,
  MobileGameOver,
  MobileGameSnapshot,
  MobileRoom,
} from '@/types/game';

interface MobileState {
  rooms: MobileRoom[];
  currentRoom: MobileRoom | null;
  game: MobileGameSnapshot | null;
  pendingGamePatches: Partial<MobileGameSnapshot> | null;
  connectionStatus: ConnectionStatus;
  error: string | null;
  notice: string | null;
  gameOver: MobileGameOver | null;
}

type Action =
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'rooms'; rooms: RoomContract[] }
  | { type: 'room'; room: RoomContract | null }
  | { type: 'roomUpdated'; room: RoomContract }
  | { type: 'game'; game: MobileGameSnapshot }
  | { type: 'patchGame'; patch: Partial<MobileGameSnapshot> }
  | { type: 'players'; players: PlayerContract[] }
  | { type: 'playerDisconnected'; seatId: string }
  | { type: 'playerIdle'; seatId: string }
  | { type: 'playerIdleCleared'; seatId: string }
  | { type: 'playerConvertedToCom'; seatId: string }
  | { type: 'error'; message: string | null }
  | { type: 'notice'; message: string | null }
  | { type: 'gameOver'; gameOver: MobileGameOver | null }
  | { type: 'resetRoom' };

type CurrentPlayerAckEvent = Extract<
  AckableClientEvent,
  | 'fill-with-com'
  | 'shuffle-teams'
  | 'start-game'
  | 'moderate-player'
  | 'change-player-team'
>;

const initialState: MobileState = {
  rooms: [],
  currentRoom: null,
  game: null,
  pendingGamePatches: null,
  connectionStatus: 'disconnected',
  error: null,
  notice: null,
  gameOver: null,
};

function reducer(state: MobileState, action: Action): MobileState {
  switch (action.type) {
    case 'connection':
      return { ...state, connectionStatus: action.status };
    case 'rooms': {
      const rooms = action.rooms.map(normalizeRoomIdentity);
      return {
        ...state,
        rooms,
        currentRoom: state.currentRoom
          ? rooms.find((room) => room.id === state.currentRoom?.id) ??
            state.currentRoom
          : null,
      };
    }
    case 'room': {
      const room = action.room ? normalizeRoomIdentity(action.room) : null;
      return {
        ...state,
        currentRoom: room,
        rooms: room
          ? [
              ...state.rooms.filter((item) => item.id !== room.id),
              room,
            ]
          : state.rooms,
      };
    }
    case 'roomUpdated': {
      const room = normalizeRoomIdentity(action.room);
      return {
        ...state,
        rooms: [
          ...state.rooms.filter((item) => item.id !== room.id),
          room,
        ],
        currentRoom:
          state.currentRoom?.id === room.id ? room : state.currentRoom,
      };
    }
    case 'game':
      return {
        ...state,
        game: state.pendingGamePatches
          ? { ...action.game, ...state.pendingGamePatches }
          : action.game,
        pendingGamePatches: null,
        error: null,
        gameOver: null,
      };
    case 'patchGame':
      if (state.game) {
        return { ...state, game: { ...state.game, ...action.patch } };
      }
      return {
        ...state,
        pendingGamePatches: {
          ...state.pendingGamePatches,
          ...action.patch,
        },
      };
    case 'players': {
      const players = normalizePlayerIdentities(action.players);
      const gamePlayers = state.game
        ? mergePlayersByIdentity(state.game.players, players)
        : players;
      const roomPlayers = state.currentRoom
        ? state.currentRoom.players.map((roomPlayer) => {
            const updated = players.find(
              (player) => player.seatId === roomPlayer.seatId,
            );
            return updated ? { ...roomPlayer, ...updated } : roomPlayer;
          })
        : null;

      return {
        ...state,
        game: state.game ? { ...state.game, players: gamePlayers } : null,
        currentRoom:
          state.currentRoom && roomPlayers
            ? { ...state.currentRoom, players: roomPlayers }
            : state.currentRoom,
      };
    }
    case 'playerDisconnected': {
      if (!state.game) return state;
      return {
        ...state,
        game: {
          ...state.game,
          players: state.game.players.map((p) =>
            p.seatId === action.seatId ? { ...p, socketId: '' } : p,
          ),
          disconnectedPlayerIds: state.game.disconnectedPlayerIds.includes(
            action.seatId,
          )
            ? state.game.disconnectedPlayerIds
            : [...state.game.disconnectedPlayerIds, action.seatId],
          idlePlayerIds: state.game.idlePlayerIds.filter(
            (id) => id !== action.seatId,
          ),
        },
      };
    }
    case 'playerIdle': {
      if (!state.game) return state;
      return {
        ...state,
        game: {
          ...state.game,
          idlePlayerIds: state.game.idlePlayerIds.includes(action.seatId)
            ? state.game.idlePlayerIds
            : [...state.game.idlePlayerIds, action.seatId],
        },
      };
    }
    case 'playerIdleCleared': {
      if (!state.game) return state;
      return {
        ...state,
        game: {
          ...state.game,
          idlePlayerIds: state.game.idlePlayerIds.filter(
            (id) => id !== action.seatId,
          ),
        },
      };
    }
    case 'playerConvertedToCom': {
      if (!state.game) return state;
      return {
        ...state,
        game: {
          ...state.game,
          disconnectedPlayerIds: state.game.disconnectedPlayerIds.filter(
            (id) => id !== action.seatId,
          ),
          idlePlayerIds: state.game.idlePlayerIds.filter(
            (id) => id !== action.seatId,
          ),
        },
      };
    }
    case 'error':
      return { ...state, error: action.message };
    case 'notice':
      return { ...state, notice: action.message };
    case 'gameOver':
      return { ...state, gameOver: action.gameOver };
    case 'resetRoom':
      return {
        ...state,
        currentRoom: null,
        game: null,
        pendingGamePatches: null,
        error: null,
        notice: null,
        gameOver: null,
      };
    default:
      return state;
  }
}

interface GameContextValue extends MobileState {
  currentPlayerId: string | null;
  isHost: boolean;
  refreshRooms: () => void;
  resumeRoom: (roomId: string) => Promise<void>;
  createRoom: (name: string, pointsToWin: number) => Promise<boolean>;
  joinRoom: (roomId: string) => Promise<boolean>;
  watchRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: () => Promise<boolean>;
  fillWithCOM: () => void;
  shuffleTeams: () => void;
  startGame: () => void;
  declareBlow: (trumpType: TrumpType, numberOfPairs: number) => void;
  passBlow: () => void;
  selectNegri: (card: string) => void;
  playCard: (card: string) => void;
  selectBaseSuit: (suit: string) => void;
  revealBrokenHand: () => void;
  removePlayer: (targetPlayerId: string) => void;
  replaceWithCOM: (targetPlayerId: string) => void;
  changePlayerTeam: (teamChanges: Record<string, number>) => void;
  updateTeamNames: (teamNames: TeamNames) => void;
  clearFeedback: () => void;
  closeGameOver: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const reconnectMessages: Record<ReconnectionFailureCode, string> = {
  roomUnavailable: '部屋が終了したためロビーへ戻りました',
  sessionInvalid: '参加情報を確認できなかったためロビーへ戻りました',
  stateInconsistent: 'ゲーム状態を復元できなかったためロビーへ戻りました',
};

const RESYNC_TIMEOUT_MS = 10000;

const toMobileGamePatch = (
  game: GameEventState,
): Partial<MobileGameSnapshot> => ({
  gamePhase: game.gamePhase,
  currentField: game.currentField,
  currentTurnSeatId: game.currentTurnSeatId,
  blowState: game.blowState,
  teamScores: game.teamScores,
  negriCard: game.negriCard,
  negriSeatId: game.negriSeatId,
  revealedAgari: game.revealedAgari,
  fields: game.fields,
});

interface ResyncFlight {
  id: number;
  promise: Promise<void>;
  resolve: () => void;
  running: boolean;
  syncStarted: boolean;
  requestedRoomId: string | null;
  targetRoomId: string | null;
  timeout: ReturnType<typeof setTimeout>;
}

export function GameProvider({ children }: PropsWithChildren) {
  const { user, session, getAccessToken } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<MobileSocket | null>(null);
  const stateRef = useRef(state);
  const gameEventStateRef = useRef(createEmptyGameEventState());
  const userRef = useRef(user);
  const brokenRequestRef = useRef<string | null>(null);
  const agariRequestRef = useRef<string | null>(null);
  const pendingAckActionsRef = useRef(new Set<string>());
  const resyncFlightRef = useRef<ResyncFlight | null>(null);
  const resyncSequenceRef = useRef(0);
  const authenticatedUserId = user?.id;
  const hasSession = session !== null;
  stateRef.current = state;
  userRef.current = user;

  useEffect(() => {
    if (!state.game && !state.currentRoom) {
      gameEventStateRef.current = createEmptyGameEventState();
    }
  }, [state.currentRoom, state.game]);

  const resolveCurrentPlayerId = useCallback(() => {
    const snapshot = stateRef.current;
    return resolvePlayerId(snapshot.game, snapshot.currentRoom, user?.id);
  }, [user?.id]);

  const emitAck = useCallback(
    <TEvent extends AckableClientEvent>(
      event: TEvent,
      payload: ClientAckPayloads[TEvent],
    ) => emitSocketWithAck(socketRef.current, event, payload),
    [],
  );

  const finishResyncFlight = useCallback(
    (roomId?: string, shouldMarkConnected = true) => {
      const flight = resyncFlightRef.current;
      if (!flight) return;
      if (flight.targetRoomId && roomId && flight.targetRoomId !== roomId) {
        return;
      }

      clearTimeout(flight.timeout);
      resyncFlightRef.current = null;
      flight.resolve();

      if (shouldMarkConnected && socketRef.current?.connected) {
        dispatch({ type: 'connection', status: 'connected' });
      }
    },
    [],
  );

  const createResyncFlight = useCallback(() => {
    const existing = resyncFlightRef.current;
    if (existing) return existing;

    const id = ++resyncSequenceRef.current;
    let resolveFlight: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
      resolveFlight = resolve;
    });
    const flight: ResyncFlight = {
      id,
      promise,
      resolve: resolveFlight,
      running: false,
      syncStarted: false,
      requestedRoomId: null,
      targetRoomId: null,
      timeout: setTimeout(() => {
        if (resyncFlightRef.current?.id !== id) return;
        resyncFlightRef.current = null;
        resolveFlight();
        dispatch({
          type: 'error',
          message:
            'ゲーム状態の再同期が完了していません。再接続を試してください',
        });
      }, RESYNC_TIMEOUT_MS),
    };

    resyncFlightRef.current = flight;
    return flight;
  }, []);

  const runResyncFlight = useCallback(
    async (flight: ResyncFlight) => {
      if (flight.running || flight.syncStarted) return;

      const socket = socketRef.current;
      if (!socket || !authenticatedUserId || !hasSession) {
        finishResyncFlight(undefined, false);
        return;
      }

      flight.running = true;
      try {
        const [token, roomId] = await Promise.all([
          getAccessToken(),
          roomStorage.get(),
        ]);
        const targetRoomId = flight.requestedRoomId ?? roomId;

        if (
          resyncFlightRef.current?.id !== flight.id ||
          socketRef.current !== socket ||
          userRef.current?.id !== authenticatedUserId
        ) {
          return;
        }

        if (token && socket.connected) {
          socket.emit('update-auth', { token });
        }

        if (!socket.connected) {
          dispatch({ type: 'connection', status: 'connecting' });
          socket.connect();
          return;
        }

        flight.syncStarted = true;
        flight.targetRoomId = targetRoomId;

        socket.emit('list-rooms');
        if (targetRoomId) {
          dispatch({ type: 'connection', status: 'resyncing' });
          socket.emit('sync-game-state', { roomId: targetRoomId });
        } else {
          finishResyncFlight(undefined);
        }
      } finally {
        flight.running = false;
      }
    },
    [
      authenticatedUserId,
      finishResyncFlight,
      getAccessToken,
      hasSession,
    ],
  );

  const resyncActiveRoom = useCallback(() => {
    const flight = createResyncFlight();
    void runResyncFlight(flight);

    return flight.promise;
  }, [createResyncFlight, runResyncFlight]);

  const resumeRoom = useCallback(
    async (roomId: string) => {
      const targetRoomId = roomId.trim();
      if (!targetRoomId) return;

      await roomStorage.set(targetRoomId);

      const activeFlight = resyncFlightRef.current;
      if (
        activeFlight?.syncStarted &&
        activeFlight.targetRoomId !== targetRoomId
      ) {
        finishResyncFlight(undefined, false);
      }

      const flight = createResyncFlight();
      flight.requestedRoomId = targetRoomId;
      void runResyncFlight(flight);
      return flight.promise;
    },
    [createResyncFlight, finishResyncFlight, runResyncFlight],
  );

  const canSendServerAction = useCallback((showError = true) => {
    const status = stateRef.current.connectionStatus;
    if (status === 'connected' && socketRef.current?.connected) {
      return true;
    }

    if (showError) {
      dispatch({
        type: 'error',
        message:
          status === 'resyncing'
            ? 'ゲーム状態を再同期しています。完了後に操作してください'
            : 'サーバーへ再接続中です。接続後に操作してください',
      });
    }
    return false;
  }, []);

  useEffect(() => {
    if (!authenticatedUserId || !hasSession) {
      finishResyncFlight(undefined, false);
      socketRef.current?.disconnect();
      socketRef.current = null;
      dispatch({ type: 'connection', status: 'disconnected' });
      dispatch({ type: 'resetRoom' });
      return;
    }

    const socket: MobileSocket = io(config.backendUrl, {
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      auth: async (callback) => {
        const [token, roomId] = await Promise.all([
          getAccessToken(),
          roomStorage.get(),
        ]);
        callback({
          token: token ?? undefined,
          roomId: roomId ?? '',
          name:
            userRef.current?.profile?.displayName ||
            userRef.current?.profile?.username ||
            userRef.current?.email ||
            'Player',
        });
      },
    });
    socketRef.current = socket;
    dispatch({ type: 'connection', status: 'connecting' });

    const setRoom = (room: RoomContract) => {
      dispatch({ type: 'room', room });
      void roomStorage.set(room.id);
    };

    const applyGameServerEvent = (event: GameServerEvent) => {
      const previous = gameEventStateRef.current;
      const next = reduceGameEvent(previous, event, {
        selfSeatId: resolveCurrentPlayerId(),
      });
      gameEventStateRef.current = next;
      if (next.players !== previous.players) {
        dispatch({ type: 'players', players: next.players });
      }
      dispatch({ type: 'patchGame', patch: toMobileGamePatch(next) });
      return next;
    };

    socket.on('connect', () => {
      dispatch({ type: 'error', message: null });
      void resyncActiveRoom();
    });
    socket.on('connect_error', (error) => {
      finishResyncFlight(undefined, false);
      dispatch({ type: 'connection', status: 'connecting' });
      dispatch({
        type: 'error',
        message: `サーバーへ接続中です: ${error.message}`,
      });
    });
    socket.on('disconnect', () => {
      finishResyncFlight(undefined, false);
      dispatch({ type: 'connection', status: 'connecting' });
    });
    socket.on('rooms-list', (rooms) => {
      dispatch({ type: 'rooms', rooms });
      if (!resyncFlightRef.current?.targetRoomId) {
        finishResyncFlight(undefined);
      }
    });
    socket.on('room-sync', ({ room, players }) => {
      setRoom(room);
      dispatch({ type: 'players', players });
      finishResyncFlight(room.id);
    });
    socket.on('room-updated', (room) => {
      dispatch({ type: 'roomUpdated', room });
    });
    socket.on('set-room-id', (roomId) => {
      void roomStorage.set(roomId);
    });
    socket.on('game-player-joined', (payload) => {
      if (payload.isSelf) {
        void roomStorage.set(payload.roomId);
      }
    });
    socket.on('update-players', (players) => {
      gameEventStateRef.current = {
        ...gameEventStateRef.current,
        players: normalizePlayerIdentities(players),
      };
      dispatch({ type: 'players', players });
      if (stateRef.current.game) {
        dispatch({
          type: 'patchGame',
          patch: {
            disconnectedPlayerIds: extractDisconnectedPlayerIds(players),
          },
        });
      }
    });
    socket.on('room-playing', ({ players }) => {
      gameEventStateRef.current = {
        ...gameEventStateRef.current,
        players: normalizePlayerIdentities(players),
      };
      dispatch({ type: 'players', players });
    });
    socket.on('game-state', (payload) => {
      gameEventStateRef.current = createGameEventStateFromSnapshot(payload);
      dispatch({
        type: 'game',
        game: normalizeGameStatePayload(payload),
      });
      void roomStorage.set(payload.roomId);
      finishResyncFlight(payload.roomId);
    });
    socket.on('reconnect-token', (playerId) => {
      dispatch({
        type: 'patchGame',
        patch: { youSeatId: asSeatId(playerId) },
      });
    });
    socket.on('game-started', (payload) => {
      const currentPlayerId = resolvePlayerId(
        stateRef.current.game,
        stateRef.current.currentRoom,
        userRef.current?.id,
      );
      gameEventStateRef.current = createGameEventStateFromStartedGame(payload);
      dispatch({
        type: 'game',
        game: createStartedGameSnapshot(
          payload,
          currentPlayerId,
          stateRef.current.currentRoom?.hostSeatId ?? null,
        ),
      });
      void roomStorage.set(payload.roomId);
    });
    socket.on('update-phase', (payload) => {
      applyGameServerEvent({ type: 'update-phase', payload });
    });
    socket.on('update-turn', (currentTurnSeatId) => {
      applyGameServerEvent({ type: 'update-turn', payload: currentTurnSeatId });
      const roomId = stateRef.current.game?.roomId;
      if (shouldAckTurn(stateRef.current.game, roomId)) {
        socket.emit('turn-ack', { roomId });
      }
    });
    socket.on('blow-started', (payload) => {
      applyGameServerEvent({ type: 'blow-started', payload });
    });
    socket.on('blow-updated', (payload) => {
      applyGameServerEvent({ type: 'blow-updated', payload });
    });
    socket.on('broken', (payload) => {
      applyGameServerEvent({ type: 'broken', payload });
      dispatch({ type: 'notice', message: '手役が成立したため配り直しました' });
    });
    socket.on('round-cancelled', (payload) => {
      applyGameServerEvent({ type: 'round-cancelled', payload });
      dispatch({ type: 'notice', message: '全員パスのため配り直しました' });
    });
    socket.on('reveal-agari', (payload) => {
      applyGameServerEvent({ type: 'reveal-agari', payload });
      dispatch({ type: 'notice', message: payload.message });
    });
    socket.on('play-setup-complete', (payload) => {
      applyGameServerEvent({ type: 'play-setup-complete', payload });
    });
    socket.on('card-played', (payload) => {
      applyGameServerEvent({ type: 'card-played', payload });
    });
    socket.on('field-updated', (field) => {
      applyGameServerEvent({ type: 'field-updated', payload: field });
    });
    socket.on('field-complete', (payload) => {
      applyGameServerEvent({ type: 'field-complete', payload });
    });
    socket.on('round-results', (payload) => {
      applyGameServerEvent({ type: 'round-results', payload });
    });
    socket.on('new-round-started', (payload) => {
      applyGameServerEvent({ type: 'new-round-started', payload });
    });
    socket.on('game-over', (payload) => {
      dispatch({ type: 'gameOver', gameOver: payload });
      void roomStorage.clear();
    });
    socket.on('game-paused', ({ message }) => {
      dispatch({ type: 'patchGame', patch: { paused: true } });
      dispatch({ type: 'notice', message });
    });
    socket.on('game-resumed', ({ message }) => {
      dispatch({ type: 'patchGame', patch: { paused: false } });
      dispatch({ type: 'notice', message });
    });
    socket.on('error-message', (message: string) => {
      dispatch({ type: 'error', message });
    });
    socket.on('back-to-lobby', (payload) => {
      void roomStorage.clear();
      dispatch({ type: 'resetRoom' });
      finishResyncFlight(undefined);
      if (payload?.code) {
        dispatch({ type: 'notice', message: reconnectMessages[payload.code] });
      }
    });
    socket.on('player-left', ({ seatId }) => {
      if (seatId === asSeatId(resolveCurrentPlayerId() ?? '')) {
        void roomStorage.clear();
        dispatch({ type: 'resetRoom' });
      }
    });
    socket.on('turn-ping', ({ roomId }) => {
      if (shouldAckTurn(stateRef.current.game, roomId)) {
        socket.emit('turn-ack', { roomId });
      }
    });
    socket.on('round-reset', () => {
      gameEventStateRef.current = {
        ...gameEventStateRef.current,
        blowState: createEmptyBlowState(),
      };
      dispatch({
        type: 'patchGame',
        patch: {
          blowState: createEmptyBlowState(),
        },
      });
    });
    socket.on('player-disconnected', (payload) => {
      const playerId = payload.seatId;
      const playerName = (payload as { playerName?: string }).playerName;
      gameEventStateRef.current = {
        ...gameEventStateRef.current,
        players: gameEventStateRef.current.players.map((player) =>
          player.seatId === playerId
            ? {
                ...player,
                socketId: '',
                name: playerName ?? player.name,
              }
            : player,
        ),
      };
      dispatch({ type: 'playerDisconnected', seatId: playerId });
      dispatch({
        type: 'notice',
        message: `${playerName ?? playerId} が切断しました`,
      });
    });
    socket.on('player-idle', (payload) => {
      const playerId = payload.seatId;
      const playerName = (payload as { playerName?: string }).playerName;
      dispatch({ type: 'playerIdle', seatId: playerId });
      dispatch({
        type: 'notice',
        message: `${playerName ?? playerId} が無操作です`,
      });
    });
    socket.on('player-idle-cleared', ({ seatId }) => {
      dispatch({ type: 'playerIdleCleared', seatId });
    });
    socket.on(
      'player-converted-to-com',
      ({ seatId, playerName, message }) => {
        gameEventStateRef.current = {
          ...gameEventStateRef.current,
          players: gameEventStateRef.current.players.map((player) =>
            player.seatId === seatId
              ? { ...player, isCOM: true, socketId: '' }
              : player,
          ),
        };
        dispatch({ type: 'playerConvertedToCom', seatId });
        if (seatId === asSeatId(resolveCurrentPlayerId() ?? '')) {
          void roomStorage.clear();
          dispatch({ type: 'resetRoom' });
        }
        dispatch({ type: 'notice', message: message ?? `${playerName ?? seatId} がCOMに置換されました` });
      },
    );
    socket.on('name-updated', (payload) => {
      if (!payload.success || !payload.seatId || !payload.name) return;
      gameEventStateRef.current = {
        ...gameEventStateRef.current,
        players: gameEventStateRef.current.players.map((player) =>
          player.seatId === payload.seatId
            ? { ...player, name: payload.name! }
            : player,
        ),
      };
      const game = stateRef.current.game;
      if (!game) return;
      dispatch({
        type: 'players',
        players: game.players.map((p) =>
          p.seatId === payload.seatId
            ? { ...p, name: payload.name! }
            : p,
        ),
      });
    });

    socket.connect();

    return () => {
      finishResyncFlight(undefined, false);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [
    authenticatedUserId,
    finishResyncFlight,
    getAccessToken,
    hasSession,
    resyncActiveRoom,
    resolveCurrentPlayerId,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void resyncActiveRoom();
      }
    });

    return () => subscription.remove();
  }, [resyncActiveRoom]);

  useEffect(() => {
    if (!session?.access_token || !socketRef.current?.connected) return;
    socketRef.current.emit('update-auth', { token: session.access_token });
  }, [session?.access_token]);

  useEffect(() => {
    const game = state.game;
    if (!canSendServerAction(false)) return;
    if (!game || game.gamePhase !== 'blow' || !game.youSeatId) {
      brokenRequestRef.current = null;
      return;
    }

    const currentPlayer = game.players.find(
      (player) => player.seatId === game.youSeatId,
    );
    if (!currentPlayer?.hasRequiredBroken) {
      brokenRequestRef.current = null;
      return;
    }

    const key = `${game.roomId}:${game.youSeatId}:${currentPlayer.hand.join(',')}`;
    if (brokenRequestRef.current === key) return;
    brokenRequestRef.current = key;
    socketRef.current?.emit('reveal-broken-hand', {
      roomId: game.roomId,
      targetSeatId: game.youSeatId,
    });
  }, [canSendServerAction, state.connectionStatus, state.game]);

  useEffect(() => {
    const game = state.game;
    if (!canSendServerAction(false)) return;
    const declaration = game?.blowState.currentHighestDeclaration;
    if (
      !game ||
      game.gamePhase !== 'play' ||
      !game.youSeatId ||
      declaration?.seatId !== game.youSeatId ||
      game.revealedAgari ||
      game.negriCard
    ) {
      agariRequestRef.current = null;
      return;
    }

    const key = `${game.roomId}:${declaration.timestamp}`;
    if (agariRequestRef.current === key) return;
    agariRequestRef.current = key;
    socketRef.current?.emit('request-agari', { roomId: game.roomId });
  }, [canSendServerAction, state.connectionStatus, state.game]);

  const refreshRooms = useCallback(() => {
    void resyncActiveRoom();
  }, [resyncActiveRoom]);

  const createRoom = useCallback(
    async (name: string, pointsToWin: number) => {
      if (!canSendServerAction()) return false;
      const response = await emitAck('create-room', {
        name: name.trim(),
        pointsToWin,
        teamAssignmentMethod: 'random',
      });
      if (!response.success || !response.room) {
        dispatch({
          type: 'error',
          message: response.error ?? '部屋を作成できませんでした',
        });
        return false;
      }

      dispatch({ type: 'room', room: response.room });
      await roomStorage.set(response.room.id);
      return true;
    },
    [canSendServerAction, emitAck],
  );

  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!canSendServerAction()) return false;
      if (!user) return false;
      const payload: JoinRoomPayload = { roomId };
      const response = await emitAck('join-room', payload);
      if (!response.success || !response.room) {
        dispatch({
          type: 'error',
          message: response.error ?? '部屋に参加できませんでした',
        });
        return false;
      }

      dispatch({ type: 'room', room: response.room });
      await roomStorage.set(roomId);
      return true;
    },
    [canSendServerAction, emitAck, user],
  );

  const watchRoom = useCallback(
    async (roomId: string) => {
      if (!canSendServerAction()) return false;
      const response = await emitAck('watch-room', { roomId });
      if (!response.success || !response.room) {
        dispatch({
          type: 'error',
          message: response.error ?? '観戦を開始できませんでした',
        });
        return false;
      }

      dispatch({ type: 'room', room: response.room });
      await roomStorage.set(roomId);
      return true;
    },
    [canSendServerAction, emitAck],
  );

  const leaveRoom = useCallback(async () => {
    if (!canSendServerAction()) return false;

    const snapshot = stateRef.current;
    const roomId = snapshot.game?.roomId ?? snapshot.currentRoom?.id;
    if (!roomId) return true;

    const response = snapshot.game?.isSpectator
      ? await emitAck('leave-watch-room', { roomId })
      : await emitAck('leave-room', { roomId });

    if (!response.success) {
      dispatch({
        type: 'error',
        message: response.error ?? 'ルームから退出できませんでした',
      });
      return false;
    }

    await roomStorage.clear();
    dispatch({ type: 'resetRoom' });
    socketRef.current?.emit('list-rooms');
    return true;
  }, [canSendServerAction, emitAck]);

  const withCurrentPlayer = useCallback(
    async (event: CurrentPlayerAckEvent) => {
      if (!canSendServerAction()) return;
      const roomId =
        stateRef.current.game?.roomId ?? stateRef.current.currentRoom?.id;
      if (!roomId) {
        dispatch({ type: 'error', message: 'プレイヤー情報を確認できません' });
        return;
      }

      const actionKey = `${event}:${roomId}`;
      if (pendingAckActionsRef.current.has(actionKey)) return;
      pendingAckActionsRef.current.add(actionKey);

      try {
        const payload: RoomActionPayload = { roomId };
        const response = await emitAck(event, payload);
        if (!response.success) {
          dispatch({
            type: 'error',
            message: response.error ?? '操作を完了できませんでした',
          });
        }
      } finally {
        pendingAckActionsRef.current.delete(actionKey);
      }
    },
    [canSendServerAction, emitAck],
  );

  const fillWithCOM = useCallback(() => {
    void withCurrentPlayer('fill-with-com');
  }, [withCurrentPlayer]);

  const shuffleTeams = useCallback(() => {
    void withCurrentPlayer('shuffle-teams');
  }, [withCurrentPlayer]);

  const startGame = useCallback(() => {
    void withCurrentPlayer('start-game');
  }, [withCurrentPlayer]);

  const emitOneWayAction = useCallback(
    (actionName: string, roomId: string, emit: () => void) => {
      if (!canSendServerAction()) return;
      const game = stateRef.current.game;
      const actionKey = [
        actionName,
        roomId,
        game?.currentTurnSeatId ?? '',
        game?.currentField?.cards.join(',') ?? '',
        game?.blowState.actionHistory.length ?? 0,
      ].join(':');
      if (pendingAckActionsRef.current.has(actionKey)) return;
      pendingAckActionsRef.current.add(actionKey);
      emit();
      setTimeout(() => pendingAckActionsRef.current.delete(actionKey), 2000);
    },
    [canSendServerAction],
  );

  const declareBlow = useCallback(
    (trumpType: TrumpType, numberOfPairs: number) => {
      const game = stateRef.current.game;
      if (!game || game.currentTurnSeatId !== game.youSeatId) {
        dispatch({ type: 'error', message: 'あなたの宣言順ではありません' });
        return;
      }
      emitOneWayAction('declare-blow', game.roomId, () => {
        socketRef.current?.emit('declare-blow', {
          roomId: game.roomId,
          declaration: { trumpType, numberOfPairs },
        });
      });
    },
    [emitOneWayAction],
  );

  const passBlow = useCallback(() => {
    const game = stateRef.current.game;
    if (!game || game.currentTurnSeatId !== game.youSeatId) {
      dispatch({ type: 'error', message: 'あなたの宣言順ではありません' });
      return;
    }
    emitOneWayAction('pass-blow', game.roomId, () => {
      socketRef.current?.emit('pass-blow', { roomId: game.roomId });
    });
  }, [emitOneWayAction]);

  const selectNegri = useCallback((card: string) => {
    const game = stateRef.current.game;
    if (!game) return;
    emitOneWayAction('select-negri', game.roomId, () => {
      socketRef.current?.emit('select-negri', { roomId: game.roomId, card });
    });
  }, [emitOneWayAction]);

  const playCard = useCallback((card: string) => {
    const game = stateRef.current.game;
    if (!game || game.currentTurnSeatId !== game.youSeatId) {
      dispatch({ type: 'error', message: 'あなたのプレイ順ではありません' });
      return;
    }
    emitOneWayAction('play-card', game.roomId, () => {
      socketRef.current?.emit('play-card', { roomId: game.roomId, card });
    });
  }, [emitOneWayAction]);

  const selectBaseSuit = useCallback((suit: string) => {
    const game = stateRef.current.game;
    if (!game) return;
    emitOneWayAction('select-base-suit', game.roomId, () => {
      socketRef.current?.emit('select-base-suit', {
        roomId: game.roomId,
        suit,
      });
    });
  }, [emitOneWayAction]);

  const revealBrokenHand = useCallback(() => {
    const game = stateRef.current.game;
    if (!game?.youSeatId) return;
    const selfSeatId = game.youSeatId;
    emitOneWayAction('reveal-broken-hand', game.roomId, () => {
      socketRef.current?.emit('reveal-broken-hand', {
        roomId: game.roomId,
        targetSeatId: selfSeatId,
      });
    });
  }, [emitOneWayAction]);

  const removePlayer = useCallback(
    (targetPlayerId: string) => {
      if (!canSendServerAction()) return;
      const roomId =
        stateRef.current.game?.roomId ?? stateRef.current.currentRoom?.id;
      if (!roomId) return;
      const payload: ModeratePlayerPayload = {
        roomId,
        targetSeatId: asSeatId(targetPlayerId),
        action: 'remove',
      };
      void emitAck('moderate-player', payload);
    },
    [canSendServerAction, emitAck],
  );

  const replaceWithCOM = useCallback(
    (targetPlayerId: string) => {
      if (!canSendServerAction()) return;
      const roomId =
        stateRef.current.game?.roomId ?? stateRef.current.currentRoom?.id;
      if (!roomId) return;
      const payload: ModeratePlayerPayload = {
        roomId,
        targetSeatId: asSeatId(targetPlayerId),
        action: 'replace-with-com',
      };
      void emitAck('moderate-player', payload);
    },
    [canSendServerAction, emitAck],
  );

  const changePlayerTeam = useCallback(
    (teamChanges: Record<string, number>) => {
      if (!canSendServerAction()) return;
      const roomId =
        stateRef.current.game?.roomId ?? stateRef.current.currentRoom?.id;
      if (!roomId) return;
      const payload: ChangePlayerTeamPayload = { roomId, teamChanges };
      void emitAck('change-player-team', payload);
    },
    [canSendServerAction, emitAck],
  );

  const updateTeamNames = useCallback(
    (teamNames: TeamNames) => {
      if (!canSendServerAction()) return;
      const roomId =
        stateRef.current.game?.roomId ?? stateRef.current.currentRoom?.id;
      if (!roomId) return;
      (socketRef.current as unknown as { emit: (event: string, payload: unknown) => void })
        ?.emit('update-team-names', { roomId, teamNames });
    },
    [canSendServerAction],
  );

  const currentPlayerId = useMemo(
    () => resolvePlayerId(state.game, state.currentRoom, user?.id),
    [state.currentRoom, state.game, user?.id],
  );
  // Prefer the room's host seat: room-sync/room-updated keep it current, while
  // the game snapshot is captured once at game start and never refreshed. Without
  // this, a host transfer (e.g. the host disconnects) leaves every client
  // believing the departed player is still host, so nobody can replace them
  // with a COM. The web client reads a single currentHostId that both room and
  // game events write, which is the behaviour mirrored here.
  const isHost =
    Boolean(currentPlayerId) &&
    (state.currentRoom?.hostSeatId ?? state.game?.hostSeatId) ===
      currentPlayerId;

  const value = useMemo<GameContextValue>(
    () => ({
      ...state,
      currentPlayerId,
      isHost,
      refreshRooms,
      resumeRoom,
      createRoom,
      joinRoom,
      watchRoom,
      leaveRoom,
      fillWithCOM,
      shuffleTeams,
      startGame,
      declareBlow,
      passBlow,
      selectNegri,
      playCard,
      selectBaseSuit,
      revealBrokenHand,
      removePlayer,
      replaceWithCOM,
      changePlayerTeam,
      updateTeamNames,
      clearFeedback: () => {
        dispatch({ type: 'error', message: null });
        dispatch({ type: 'notice', message: null });
      },
      closeGameOver: () => dispatch({ type: 'gameOver', gameOver: null }),
    }),
    [
      changePlayerTeam,
      createRoom,
      currentPlayerId,
      declareBlow,
      fillWithCOM,
      isHost,
      joinRoom,
      leaveRoom,
      passBlow,
      playCard,
      refreshRooms,
      removePlayer,
      replaceWithCOM,
      resumeRoom,
      revealBrokenHand,
      selectBaseSuit,
      selectNegri,
      shuffleTeams,
      startGame,
      state,
      updateTeamNames,
      watchRoom,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) {
    throw new Error('useGame must be used inside GameProvider');
  }

  return value;
}
