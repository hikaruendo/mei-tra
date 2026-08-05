import { io, Socket } from 'socket.io-client';
import { getSocketBaseUrl } from '@/lib/socket-url';

let socket: Socket | null = null;
let latestAuthToken: string | undefined;
let authTokenProvider: (() => Promise<string | null>) | undefined;

type WindowWithGameSocket = Window & {
  __MEITRA_GAME_SOCKET__?: Socket;
};

function getWindowSocket(): Socket | null {
  if (typeof window === 'undefined') return null;

  return (window as WindowWithGameSocket).__MEITRA_GAME_SOCKET__ ?? null;
}

function setWindowSocket(nextSocket: Socket | null): void {
  if (typeof window === 'undefined') return;

  const gameWindow = window as WindowWithGameSocket;
  if (nextSocket) {
    gameWindow.__MEITRA_GAME_SOCKET__ = nextSocket;
    return;
  }

  delete gameWindow.__MEITRA_GAME_SOCKET__;
}

export function setSocketAuthTokenProvider(
  provider: (() => Promise<string | null>) | undefined,
): void {
  authTokenProvider = provider;
}

function detectSafari(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
  const isIOS = /ipad|iphone|ipod/.test(userAgent);

  return isSafari || isIOS;
}

export function getSocket(authToken?: string): Socket {
  latestAuthToken = authToken ?? latestAuthToken;
  socket = getWindowSocket() ?? socket;

  if (!socket && typeof window !== 'undefined') {
    const socketUrl = getSocketBaseUrl();

    const isSafari = detectSafari();

    const socketOptions = {
      transports: isSafari ? ['polling', 'websocket'] : ['websocket', 'polling'],
      // Use callback so roomId is read from sessionStorage on every reconnection attempt.
      // This ensures that after a server restart, the socket reconnects with the correct
      // roomId (set in sessionStorage when the player joined a room), allowing the server
      // to re-add the socket to the correct socket.io room and receive room broadcasts.
      auth: async (cb: (data: { roomId: string; token?: string }) => void) => {
        const currentRoomId = sessionStorage.getItem('roomId') || '';
        console.log('[Socket] Auth callback — roomId from sessionStorage:', currentRoomId || 'none');
        if (authTokenProvider) {
          latestAuthToken = await authTokenProvider() ?? latestAuthToken;
        }
        cb({ roomId: currentRoomId, token: latestAuthToken });
      },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      ...(isSafari && {
        upgrade: true,
        rememberUpgrade: true,
      }),
    };

    socket = io(socketUrl, socketOptions);
    setWindowSocket(socket);

    console.log('[Socket] Creating new connection to:', socketUrl);
    console.log('[Socket] Browser:', isSafari ? 'Safari/iOS' : 'Other');
    console.log('[Socket] Transports:', socketOptions.transports);
    console.log('[Socket] Auth token:', authToken ? 'present' : 'none');
    console.log('[Socket] Auth roomId will be read dynamically from sessionStorage on each connect');

    socket.on('connect', () => {
      console.log('[Socket] Connected successfully with transport:', socket?.io.engine.transport.name, {
        socketId: socket?.id ?? null,
        storedRoomId: sessionStorage.getItem('roomId') || null,
      });
    });

    socket.on('connect_error', (error) => {
      // Expected during backend cold start / local backend restarts.
      console.warn('[Socket] Connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', {
        reason,
        socketId: socket?.id ?? null,
        storedRoomId: sessionStorage.getItem('roomId') || null,
      });
    });
  }
  return socket!;
}

export function getExistingSocket(): Socket | null {
  socket = getWindowSocket() ?? socket;
  return socket;
}

export function reconnectSocket(authToken?: string): Socket {
  latestAuthToken = authToken ?? latestAuthToken;
  const existingSocket = getExistingSocket();

  if (existingSocket) {
    existingSocket.auth = async (cb: (data: { roomId: string; token?: string }) => void) => {
      const currentRoomId = sessionStorage.getItem('roomId') || '';
      console.log('[Socket] Reconnect auth callback — roomId from sessionStorage:', currentRoomId || 'none');
      if (authTokenProvider) {
        latestAuthToken = await authTokenProvider() ?? latestAuthToken;
      }
      cb({ roomId: currentRoomId, token: latestAuthToken });
    };
    existingSocket.disconnect();
    existingSocket.connect();
    return existingSocket;
  }

  const nextSocket = getSocket(authToken);
  nextSocket.connect();
  return nextSocket;
}

export function disconnectSocket(): void {
  const existingSocket = getExistingSocket();
  existingSocket?.disconnect();
  socket = null;
  setWindowSocket(null);
  latestAuthToken = undefined;
}
