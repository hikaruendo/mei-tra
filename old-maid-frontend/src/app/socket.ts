import { io, Socket } from 'socket.io-client';

// const socket = io('https://old-maid-backend.fly.dev');
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    socket = io("http://localhost:3333");
  }
  return socket!;
}