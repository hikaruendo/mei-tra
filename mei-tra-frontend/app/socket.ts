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

    // Only authenticated users can connect
    const roomId = sessionStorage.getItem('roomId') || '';

    console.log('[Socket] Retrieved from sessionStorage:', {
      roomId: roomId || 'none',
      hasAuthToken: !!authToken
    });

    const isSafari = detectSafari();

    const socketOptions = {
      transports: isSafari ? ['polling', 'websocket'] : ['websocket', 'polling'],
      auth: {
        roomId,
        token: authToken,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
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

    socket.on('connect', () => {
      console.log('[Socket] Connected successfully with transport:', socket?.io.engine.transport.name);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
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