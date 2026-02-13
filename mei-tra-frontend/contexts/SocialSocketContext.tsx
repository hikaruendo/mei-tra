'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { CloudflareSocialSocket } from '../lib/cloudflareSocialSocket';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const SOCIAL_BACKEND = process.env.NEXT_PUBLIC_SOCIAL_BACKEND || 'nestjs';
const CLOUDFLARE_WORKER_URL = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'http://localhost:8787';

type SocialSocket = Socket | CloudflareSocialSocket;

interface SocialSocketContextValue {
  socket: SocialSocket | null;
  isConnected: boolean;
}

const SocialSocketContext = createContext<SocialSocketContextValue | undefined>(
  undefined,
);

export function SocialSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, getAccessToken } = useAuth();
  const socketRef = useRef<SocialSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) {
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

    if (SOCIAL_BACKEND === 'cloudflare') {
      const cfSocket = new CloudflareSocialSocket(CLOUDFLARE_WORKER_URL, getAccessToken);

      cfSocket.on('connect', () => {
        console.log('[SocialSocketProvider] Connected to Cloudflare Worker');
        setIsConnected(true);
      });

      cfSocket.on('disconnect', () => {
        console.log('[SocialSocketProvider] Disconnected from Cloudflare Worker');
        setIsConnected(false);
      });

      socketRef.current = cfSocket;
    } else {
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
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?.id, getAccessToken]);

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
