'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface SocialSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocialSocketContext = createContext<SocialSocketContextValue | undefined>(
  undefined,
);

export function SocialSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      // Disconnect socket when user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    if (socketRef.current) {
      return;
    }

    const socket = io(`${BACKEND_URL}/social`, {
      auth: {
        userId: user.id,
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[SocialSocketProvider] Connected to /social namespace');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[SocialSocketProvider] Disconnected from /social namespace');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[SocialSocketProvider] Connection error:', error);
      setIsConnected(false);
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?.id]);

  return (
    <SocialSocketContext.Provider
      value={{ socket: socketRef.current, isConnected }}
    >
      {children}
    </SocialSocketContext.Provider>
  );
}

export function useSocialSocketContext(): SocialSocketContextValue {
  const context = useContext(SocialSocketContext);
  if (context === undefined) {
    throw new Error(
      'useSocialSocketContext must be used within a SocialSocketProvider',
    );
  }
  return context;
}
