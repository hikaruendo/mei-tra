import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const socketUrl = isDevelopment 
      ? 'http://localhost:3333'
      : 'https://mei-tra-backend.fly.dev';
    
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