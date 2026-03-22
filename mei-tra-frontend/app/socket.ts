import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function detectSafari(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
  const isIOS = /ipad|iphone|ipod/.test(userAgent);

  return isSafari || isIOS;
}

export function getSocket(authToken?: string): Socket {
  if (!socket && typeof window !== 'undefined') {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3333';

    const isSafari = detectSafari();

    const socketOptions = {
      transports: isSafari ? ['polling', 'websocket'] : ['websocket', 'polling'],
      // Use callback so roomId is read from sessionStorage on every reconnection attempt.
      // This ensures that after a server restart, the socket reconnects with the correct
      // roomId (set in sessionStorage when the player joined a room), allowing the server
      // to re-add the socket to the correct socket.io room and receive room broadcasts.
      auth: (cb: (data: { roomId: string; token?: string }) => void) => {
        const currentRoomId = sessionStorage.getItem('roomId') || '';
        console.log('[Socket] Auth callback — roomId from sessionStorage:', currentRoomId || 'none');
        cb({ roomId: currentRoomId, token: authToken });
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
      console.error('[Socket] Connection error:', error.message);
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

export function reconnectSocket(authToken?: string): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  getSocket(authToken);
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
