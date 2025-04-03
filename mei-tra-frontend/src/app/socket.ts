import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3333';
    
    const reconnectToken = localStorage.getItem('reconnectToken') || '';
    socket = io(socketUrl, {
      transports: ['websocket'],
      auth: {
        reconnectToken,
      },
    });
  }
  return socket!;
}