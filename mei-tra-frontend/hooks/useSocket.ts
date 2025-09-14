import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../app/socket';
import { useAuth } from './useAuth';

export interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
}

export function useSocket(): UseSocketReturn {
  const { getAccessToken, user, loading } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Don't initialize socket if auth is still loading or already initializing
    if (loading || isInitializingRef.current) {
      return;
    }

    const initializeSocket = async () => {
      isInitializingRef.current = true;
      setIsConnecting(true);

      try {
        // Get the current auth token
        const token = await getAccessToken();

        // If token has changed, reconnect
        if (token !== authTokenRef.current) {
          authTokenRef.current = token;

          if (socketRef.current) {
            disconnectSocket();
            setIsConnected(false);
          }

          socketRef.current = getSocket(token || undefined);
        } else if (!socketRef.current) {
          // Initialize socket if it doesn't exist
          socketRef.current = getSocket(token || undefined);
        } else {
          // Socket exists and token hasn't changed
          setIsConnecting(false);
          isInitializingRef.current = false;
          return;
        }

        // Set up connection listeners
        if (socketRef.current) {
          // Remove existing listeners to prevent duplicates
          socketRef.current.off('connect');
          socketRef.current.off('disconnect');
          socketRef.current.off('connect_error');

          socketRef.current.on('connect', () => {
            setIsConnected(true);
            setIsConnecting(false);
            isInitializingRef.current = false;
          });

          socketRef.current.on('disconnect', () => {
            setIsConnected(false);
            setIsConnecting(false);
            isInitializingRef.current = false;
          });

          socketRef.current.on('connect_error', (error) => {
            console.error('[useSocket] Connection error:', error);
            setIsConnecting(false);
            isInitializingRef.current = false;
          });
        }
      } catch (error) {
        console.error('[useSocket] Error in initializeSocket:', error);
        setIsConnecting(false);
        isInitializingRef.current = false;
      }
    };

    initializeSocket();
  }, [user, loading, getAccessToken]);

  useEffect(() => {
    return () => {
      // Don't disconnect on unmount as other components might be using it
      // The socket will be cleaned up when the page is refreshed or closed
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting
  };
}