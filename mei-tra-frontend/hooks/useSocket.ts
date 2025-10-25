import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../app/socket';
import { useAuth } from './useAuth';

export interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
}

export function useSocket(): UseSocketReturn {
  const { getAccessToken, loading } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Wait for auth to complete before initializing socket
    if (isInitializingRef.current || loading) {
      return;
    }

    const initializeSocket = async () => {
      isInitializingRef.current = true;

      // If a socket already exists and is connected, reflect that immediately
      if (socketRef.current?.connected) {
        setIsConnected(true);
        setIsConnecting(false);
        isInitializingRef.current = false;
        return;
      }

      setIsConnecting(true);

      try {
        // Get auth token first - authentication is required
        console.log('[useSocket] Getting auth token before connection...');
        const token = await getAccessToken();

        if (!token) {
          console.error('[useSocket] No auth token available - cannot connect');
          setIsConnected(false);
          setIsConnecting(false);
          isInitializingRef.current = false;
          return;
        }

        console.log('[useSocket] Auth token retrieved, initializing socket with token');
        authTokenRef.current = token;

        // Initialize socket with auth token
        if (!socketRef.current) {
          socketRef.current = getSocket(token);
        }

        // Set up connection listeners
        if (socketRef.current) {
          // Clear any existing listeners to prevent duplicates
          socketRef.current.off('connect');
          socketRef.current.off('disconnect');
          socketRef.current.off('connect_error');

          socketRef.current.on('connect', () => {
            console.log('[useSocket] Socket connected successfully');
            setIsConnected(true);
            setIsConnecting(false);
            isInitializingRef.current = false;
          });

          socketRef.current.on('disconnect', () => {
            console.log('[useSocket] Socket disconnected');
            setIsConnected(false);
            setIsConnecting(false);
            isInitializingRef.current = false;
          });

          socketRef.current.on('connect_error', (error) => {
            console.error('[useSocket] Connection error:', error);
            setIsConnected(false);
            setIsConnecting(false);
            isInitializingRef.current = false;
          });

          // Connect the socket if not already connected
          if (!socketRef.current.connected) {
            console.log('[useSocket] Attempting to connect socket with auth token...');
            socketRef.current.connect();
          } else {
            // Already connected, update state immediately
            console.log('[useSocket] Socket already connected');
            setIsConnected(true);
            setIsConnecting(false);
            isInitializingRef.current = false;
          }
        }
      } catch (error) {
        console.error('[useSocket] Error in initializeSocket:', error);
        setIsConnected(false);
        setIsConnecting(false);
        isInitializingRef.current = false;
      }
    };

    initializeSocket();
  }, [loading, getAccessToken]); // Wait for auth loading to complete

  // Note: Auth token is now provided at connection time, so no need for separate update-auth effect
  // The token is already included in the initial socket connection

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