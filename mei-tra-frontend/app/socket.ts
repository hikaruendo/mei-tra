import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(authToken?: string): Socket {
  if (!socket && typeof window !== 'undefined') {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3333';

    const reconnectToken = sessionStorage.getItem('reconnectToken') || '';
    const roomId = sessionStorage.getItem('roomId') || '';

    socket = io(socketUrl, {
      transports: ['websocket'],
      auth: {
        reconnectToken,
        roomId,
        token: authToken,
        name: sessionStorage.getItem('playerName') || 'Anonymous',
      },
    });

    console.log('[Socket] Creating new connection to:', socketUrl);
    console.log('[Socket] Auth token:', authToken ? 'present' : 'none');
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