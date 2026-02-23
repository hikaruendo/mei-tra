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
  const { getAccessToken, loading, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let managedSocket: Socket | null = null;

    // Wait for auth to complete before initializing socket, skip if not logged in
    if (isInitializingRef.current || loading || !user) {
      return;
    }

    const initializeSocket = async () => {
      isInitializingRef.current = true;

      // If a socket already exists and is connected, reflect that immediately
      if (socketRef.current?.connected) {
        if (isMounted) {
          setIsConnected(true);
          setIsConnecting(false);
        }
        isInitializingRef.current = false;
        return;
      }

      if (isMounted) {
        setIsConnecting(true);
      }

      try {
        // Get auth token first - authentication is required
        console.log('[useSocket] Getting auth token before connection...');
        const token = authTokenRef.current ?? await getAccessToken();

        if (!token) {
          console.error('[useSocket] No auth token available - cannot connect');
          if (isMounted) {
            setIsConnected(false);
            setIsConnecting(false);
          }
          isInitializingRef.current = false;
          return;
        }

        console.log('[useSocket] Auth token retrieved, initializing socket with token');
        authTokenRef.current = token;

        // Initialize socket with auth token
        if (!socketRef.current) {
          socketRef.current = getSocket(token);
        }
        managedSocket = socketRef.current;

        // Set up connection listeners
        if (managedSocket) {
          const handleConnect = () => {
            console.log('[useSocket] Socket connected successfully');
            if (!isMounted) return;
            setIsConnected(true);
            setIsConnecting(false);
            isInitializingRef.current = false;
          };

          const handleDisconnect = () => {
            console.log('[useSocket] Socket disconnected');
            if (!isMounted) return;
            setIsConnected(false);
            setIsConnecting(true);
            isInitializingRef.current = false;
          };

          const handleConnectError = (error: Error) => {
            console.error('[useSocket] Connection error:', error);
            if (!isMounted) return;
            setIsConnected(false);
            // Backend cold start中も再接続を継続する
            setIsConnecting(true);
            isInitializingRef.current = false;
          };

          const handleReconnectAttempt = () => {
            if (!isMounted) return;
            setIsConnecting(true);
          };

          const handleReconnectFailed = () => {
            if (!isMounted) return;
            setIsConnected(false);
            setIsConnecting(false);
          };

          managedSocket.on('connect', handleConnect);
          managedSocket.on('disconnect', handleDisconnect);
          managedSocket.on('connect_error', handleConnectError);
          managedSocket.io.on('reconnect_attempt', handleReconnectAttempt);
          managedSocket.io.on('reconnect_failed', handleReconnectFailed);

          // Connect the socket if not already connected
          if (!managedSocket.connected) {
            console.log('[useSocket] Attempting to connect socket with auth token...');
            managedSocket.connect();
          } else {
            // Already connected, update state immediately
            console.log('[useSocket] Socket already connected');
            if (isMounted) {
              setIsConnected(true);
              setIsConnecting(false);
            }
            isInitializingRef.current = false;
          }

          return () => {
            managedSocket?.off('connect', handleConnect);
            managedSocket?.off('disconnect', handleDisconnect);
            managedSocket?.off('connect_error', handleConnectError);
            managedSocket?.io.off('reconnect_attempt', handleReconnectAttempt);
            managedSocket?.io.off('reconnect_failed', handleReconnectFailed);
          };
        }
      } catch (error) {
        console.error('[useSocket] Error in initializeSocket:', error);
        if (isMounted) {
          setIsConnected(false);
          setIsConnecting(false);
        }
        isInitializingRef.current = false;
      }
    };

    let cleanupHandlers: (() => void) | undefined;
    initializeSocket().then((cleanup) => {
      cleanupHandlers = cleanup;
    });

    return () => {
      isMounted = false;
      cleanupHandlers?.();
    };
  }, [loading, user, getAccessToken]); // Wait for auth loading to complete

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
