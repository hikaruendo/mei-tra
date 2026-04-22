'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { getSocketBaseUrl } from '@/lib/socket-url';

interface SocialSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocialSocketContext = createContext<SocialSocketContextValue | undefined>(
  undefined,
);

export function SocialSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, getAccessToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!user?.id) {
      // Disconnect socket when user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    if (socketRef.current) {
      setSocket(socketRef.current);
      setIsConnected(socketRef.current.connected);
      return;
    }

    const initializeSocket = async () => {
      let token: string | null = null;
      try {
        token = await getAccessToken();
      } catch (error) {
        console.error('[SocialSocketProvider] Failed to get auth token:', error);
        if (isMounted) {
          setIsConnected(false);
        }
        return;
      }

      if (!isMounted) return;

      if (!token) {
        console.error('[SocialSocketProvider] No auth token available');
        setIsConnected(false);
        return;
      }

      const socket = io(`${getSocketBaseUrl()}/social`, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 30000,
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
      setSocket(socket);
    };

    void initializeSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [user?.id, getAccessToken]);

  return (
    <SocialSocketContext.Provider
      value={{ socket, isConnected }}
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
