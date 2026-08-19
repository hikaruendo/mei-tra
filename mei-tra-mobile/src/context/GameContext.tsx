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
import {
  hasBlowActivity,
  resolveLastBlowSeatId,
  shouldAbortRevealOnTurn,
  type FirstTurnReveal,
} from '@meitra/game-client/first-turn-reveal';
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
  extractDisconnectedSeatIds,
  mergePlayersByIdentity,
  normalizeGameStatePayload,
  resolveSeatId,
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
import type { FeedbackMessage } from '@/types/feedback';

interface MobileState {
  rooms: MobileRoom[];
  currentRoom: MobileRoom | null;
  game: MobileGameSnapshot | null;
  pendingGamePatches: Partial<MobileGameSnapshot> | null;
  connectionStatus: ConnectionStatus;
  error: FeedbackMessage | null;
  notice: FeedbackMessage | null;
  gameOver: MobileGameOver | null;
  /**
   * Set only by the live 'game-started' event; snapshot restores clear it so a
   * reconnect never replays the reveal.
   */
  firstTurnReveal: MobileFirstTurnReveal | null;
}

export type MobileFirstTurnReveal = FirstTurnReveal;

type Action =
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'rooms'; rooms: RoomContract[] }
  | { type: 'room'; room: RoomContract | null }
  | { type: 'game'; game: MobileGameSnapshot }
  | { type: 'patchGame'; patch: Partial<MobileGameSnapshot> }
  | { type: 'players'; players: PlayerContract[] }
  | { type: 'playerDisconnected'; seatId: string }
  | { type: 'playerIdle'; seatId: string }
  | { type: 'playerIdleCleared'; seatId: string }
  | { type: 'playerConvertedToCom'; seatId: string }
  | { type: 'error'; message: FeedbackMessage | null }
  | { type: 'notice'; message: FeedbackMessage | null }
  | { type: 'gameOver'; gameOver: MobileGameOver | null }
  | { type: 'firstTurnReveal'; reveal: MobileFirstTurnReveal | null }
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
  firstTurnReveal: null,
};

function reducer(state: MobileState, action: Action): MobileState {
  switch (action.type) {
    case 'connection':
      return { ...state, connectionStatus: action.status };
    case 'rooms': {
      const rooms = action.rooms;
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
      const room = action.room;
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
      const players = action.players;
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
          disconnectedSeatIds: state.game.disconnectedSeatIds.includes(
            action.seatId,
          )
            ? state.game.disconnectedSeatIds
            : [...state.game.disconnectedSeatIds, action.seatId],
          idleSeatIds: state.game.idleSeatIds.filter(
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
          idleSeatIds: state.game.idleSeatIds.includes(action.seatId)
            ? state.game.idleSeatIds
            : [...state.game.idleSeatIds, action.seatId],
        },
      };
    }
    case 'playerIdleCleared': {
      if (!state.game) return state;
      return {
        ...state,
        game: {
          ...state.game,
          idleSeatIds: state.game.idleSeatIds.filter(
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
          disconnectedSeatIds: state.game.disconnectedSeatIds.filter(
            (id) => id !== action.seatId,
          ),
          idleSeatIds: state.game.idleSeatIds.filter(
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
    case 'firstTurnReveal':
      return { ...state, firstTurnReveal: action.reveal };
    case 'resetRoom':
      return {
        ...state,
        currentRoom: null,
        game: null,
        pendingGamePatches: null,
        error: null,
        notice: null,
        gameOver: null,
        firstTurnReveal: null,
      };
    default:
      return state;
  }
}

interface GameContextValue extends MobileState {
  currentSeatId: string | null;
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
  removePlayer: (targetSeatId: string) => void;
  replaceWithCOM: (targetSeatId: string) => void;
  changePlayerTeam: (teamChanges: Record<string, number>) => void;
  updateTeamNames: (teamNames: TeamNames) => void;
  clearFeedback: () => void;
  closeGameOver: () => void;
  clearFirstTurnReveal: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// Catalogue keys; read through t() at dispatch time.
const reconnectMessageKeys: Record<ReconnectionFailureCode, string> = {
  roomUnavailable: 'game.roomUnavailable',
  sessionInvalid: 'game.sessionInvalid',
  stateInconsistent: 'game.stateInconsistent',
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
  // Mirrors state.firstTurnReveal for the long-lived socket handlers, which
  // need it synchronously and would otherwise close over a stale value.
  const firstTurnRevealRef = useRef<MobileFirstTurnReveal | null>(null);
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
  // Re-sync after reducer-only changes such as 'resetRoom'.
  firstTurnRevealRef.current = state.firstTurnReveal;

  useEffect(() => {
    if (!state.game && !state.currentRoom) {
      gameEventStateRef.current = createEmptyGameEventState();
    }
  }, [state.currentRoom, state.game]);

  const resolveCurrentSeatId = useCallback(() => {
    const snapshot = stateRef.current;
    return resolveSeatId(snapshot.game, snapshot.currentRoom, user?.id);
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
          message: { key: 'game.resyncIncomplete' },
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
        message: {
          key:
            status === 'resyncing'
              ? 'game.resyncWait'
              : 'game.reconnectWait',
        },
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

    const setFirstTurnReveal = (reveal: MobileFirstTurnReveal | null) => {
      firstTurnRevealRef.current = reveal;
      dispatch({ type: 'firstTurnReveal', reveal });
    };

    const applyGameServerEvent = (event: GameServerEvent) => {
      const previous = gameEventStateRef.current;
      const next = reduceGameEvent(previous, event, {
        selfSeatId: resolveCurrentSeatId(),
      });
      gameEventStateRef.current = next;
      if (next.players !== previous.players) {
        dispatch({ type: 'players', players: next.players });
      }
      const patch = toMobileGamePatch(next);
      dispatch({
        type: 'patchGame',
        // While the start reveal plays, hold the turn back so the animation is
        // not spoiled; `clearFirstTurnReveal` applies it afterwards.
        patch: firstTurnRevealRef.current
          ? { ...patch, currentTurnSeatId: null }
          : patch,
      });
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
        message: {
          key: 'game.connecting',
          params: { message: error.message },
        },
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
        players,
      };
      dispatch({ type: 'players', players });
      if (stateRef.current.game) {
        dispatch({
          type: 'patchGame',
          patch: {
            disconnectedSeatIds: extractDisconnectedSeatIds(players),
          },
        });
      }
    });
    socket.on('game-state', (payload) => {
      gameEventStateRef.current = createGameEventStateFromSnapshot(payload);
      const snapshot = normalizeGameStatePayload(payload);
      dispatch({
        type: 'game',
        // The bootstrap snapshot right after game start already carries the
        // chosen seat; hold it back until the reveal finishes.
        game: firstTurnRevealRef.current
          ? { ...snapshot, currentTurnSeatId: null }
          : snapshot,
      });
      void roomStorage.set(payload.roomId);
      finishResyncFlight(payload.roomId);
    });
    socket.on('reconnect-token', (seatId) => {
      dispatch({
        type: 'patchGame',
        patch: { youSeatId: asSeatId(seatId) },
      });
    });
    socket.on('game-started', (payload) => {
      const currentSeatId = resolveSeatId(
        stateRef.current.game,
        stateRef.current.currentRoom,
        userRef.current?.id,
      );
      gameEventStateRef.current = createGameEventStateFromStartedGame(payload);
      dispatch({
        type: 'game',
        game: createStartedGameSnapshot(
          payload,
          currentSeatId,
          stateRef.current.currentRoom?.hostSeatId ?? null,
        ),
      });

      // The server holds `update-turn` back for the reveal, so either animate
      // it or, when the reveal is off, apply the turn now rather than idle.
      const animate =
        userRef.current?.profile?.startPlayerAnimation !== false;
      // The payload array is the server roster order, i.e. blow order.
      const lastBlowSeatId = payload.currentTurnSeatId
        ? resolveLastBlowSeatId(
            payload.players.map((player) => player.seatId),
            payload.currentTurnSeatId,
          )
        : null;
      if (payload.currentTurnSeatId && lastBlowSeatId && animate) {
        setFirstTurnReveal({
          roomId: payload.roomId,
          seatId: payload.currentTurnSeatId,
          lastBlowSeatId,
          token: Date.now(),
        });
      } else {
        setFirstTurnReveal(null);
        if (payload.currentTurnSeatId) {
          // Reduce it rather than patching directly, so the shared reducer
          // agrees and a later event cannot blank the turn again.
          applyGameServerEvent({
            type: 'update-turn',
            payload: payload.currentTurnSeatId,
          });
        }
      }

      void roomStorage.set(payload.roomId);
    });
    socket.on('update-phase', (payload) => {
      applyGameServerEvent({ type: 'update-phase', payload });
    });
    socket.on('update-turn', (currentTurnSeatId) => {
      if (
        shouldAbortRevealOnTurn(firstTurnRevealRef.current, currentTurnSeatId)
      ) {
        setFirstTurnReveal(null);
      }
      applyGameServerEvent({ type: 'update-turn', payload: currentTurnSeatId });
      const roomId = stateRef.current.game?.roomId;
      if (shouldAckTurn(stateRef.current.game, roomId)) {
        socket.emit('turn-ack', { roomId });
      }
    });
    socket.on('blow-updated', (payload) => {
      // A player whose reveal is disabled can declare before our animation
      // ends; cut it short rather than narrate a turn that already moved.
      if (hasBlowActivity(payload)) {
        setFirstTurnReveal(null);
      }
      applyGameServerEvent({ type: 'blow-updated', payload });
    });
    socket.on('broken', (payload) => {
      applyGameServerEvent({ type: 'broken', payload });
      dispatch({ type: 'notice', message: { key: 'game.redealHand' } });
    });
    socket.on('round-cancelled', (payload) => {
      applyGameServerEvent({ type: 'round-cancelled', payload });
      dispatch({ type: 'notice', message: { key: 'game.redealAllPass' } });
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
        dispatch({
          type: 'notice',
          message: { key: reconnectMessageKeys[payload.code] },
        });
      }
    });
    socket.on('player-left', ({ seatId }) => {
      if (seatId === asSeatId(resolveCurrentSeatId() ?? '')) {
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
      const seatId = payload.seatId;
      const playerName = (payload as { playerName?: string }).playerName;
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
      dispatch({ type: 'playerDisconnected', seatId: seatId });
      dispatch({
        type: 'notice',
        message: {
          key: 'game.playerDisconnected',
          params: { name: playerName ?? seatId },
        },
      });
    });
    socket.on('player-idle', (payload) => {
      const seatId = payload.seatId;
      const playerName = (payload as { playerName?: string }).playerName;
      dispatch({ type: 'playerIdle', seatId: seatId });
      dispatch({
        type: 'notice',
        message: {
          key: 'game.playerIdle',
          params: { name: playerName ?? seatId },
        },
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
        if (seatId === asSeatId(resolveCurrentSeatId() ?? '')) {
          void roomStorage.clear();
          dispatch({ type: 'resetRoom' });
        }
        dispatch({ type: 'notice', message:
            message ??
            { key: 'game.playerReplacedByCom', params: { name: playerName ?? seatId } } });
      },
    );
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
    resolveCurrentSeatId,
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
          message: response.error ?? { key: 'game.createRoomFailed' },
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
          message: response.error ?? { key: 'game.joinRoomFailed' },
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
          message: response.error ?? { key: 'game.watchFailed' },
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
        message: response.error ?? { key: 'game.leaveFailed' },
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
        dispatch({ type: 'error', message: { key: 'game.playerUnknown' } });
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
            message: response.error ?? { key: 'game.actionFailed' },
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
        dispatch({ type: 'error', message: { key: 'game.notYourBlowTurn' } });
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
      dispatch({ type: 'error', message: { key: 'game.notYourBlowTurn' } });
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
      dispatch({ type: 'error', message: { key: 'game.notYourPlayTurn' } });
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
    emitOneWayAction('reveal-broken-hand', game.roomId, () => {
      socketRef.current?.emit('reveal-broken-hand', {
        roomId: game.roomId,
      });
    });
  }, [emitOneWayAction]);

  const removePlayer = useCallback(
    (targetSeatId: string) => {
      if (!canSendServerAction()) return;
      const roomId =
        stateRef.current.game?.roomId ?? stateRef.current.currentRoom?.id;
      if (!roomId) return;
      const payload: ModeratePlayerPayload = {
        roomId,
        targetSeatId: asSeatId(targetSeatId),
        action: 'remove',
      };
      void emitAck('moderate-player', payload);
    },
    [canSendServerAction, emitAck],
  );

  const replaceWithCOM = useCallback(
    (targetSeatId: string) => {
      if (!canSendServerAction()) return;
      const roomId =
        stateRef.current.game?.roomId ?? stateRef.current.currentRoom?.id;
      if (!roomId) return;
      const payload: ModeratePlayerPayload = {
        roomId,
        targetSeatId: asSeatId(targetSeatId),
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

  const currentSeatId = useMemo(
    () => resolveSeatId(state.game, state.currentRoom, user?.id),
    [state.currentRoom, state.game, user?.id],
  );
  // The room snapshot is refreshed after host changes; the game snapshot is
  // captured at game start and can still contain the previous host seat.
  const isHost =
    Boolean(currentSeatId) &&
    (state.currentRoom?.hostSeatId ?? state.game?.hostSeatId) ===
      currentSeatId;

  const value = useMemo<GameContextValue>(
    () => ({
      ...state,
      currentSeatId,
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
      clearFirstTurnReveal: () => {
        firstTurnRevealRef.current = null;
        dispatch({ type: 'firstTurnReveal', reveal: null });
        // Apply whatever turn the reducer learned while the reveal held it
        // back, so the indicator is never left blank.
        dispatch({
          type: 'patchGame',
          patch: {
            currentTurnSeatId: gameEventStateRef.current.currentTurnSeatId,
          },
        });
      },
    }),
    [
      changePlayerTeam,
      createRoom,
      currentSeatId,
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
