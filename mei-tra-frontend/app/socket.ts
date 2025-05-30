import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3333';
    
    const reconnectToken = sessionStorage.getItem('reconnectToken') || '';
    const roomId = sessionStorage.getItem('roomId') || '';
    
    socket = io(socketUrl, {
      transports: ['websocket'],
      auth: {
        reconnectToken,
        roomId,
      },
    });
  }
  return socket!;
}