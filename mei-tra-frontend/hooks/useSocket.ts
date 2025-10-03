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
  const { getAccessToken, user, loading } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const isUpdatingAuthRef = useRef<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Initialize socket immediately, don't wait for auth
    if (isInitializingRef.current) {
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
        // Initialize socket immediately without waiting for auth token
        if (!socketRef.current) {
          // Start with no token initially
          socketRef.current = getSocket(undefined);
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
            console.log('[useSocket] Attempting to connect socket...');
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
  }, []); // Remove all dependencies to initialize immediately

  // Separate effect to update auth token when available
  useEffect(() => {
    if (!socketRef.current || loading) {
      return;
    }

    const updateAuthToken = async () => {
      try {
        console.log('[useSocket] Attempting to get access token...');
        const token = await getAccessToken();

        console.log('[useSocket] Token retrieved:', {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          tokenStart: token ? token.substring(0, 20) + '...' : 'null',
          currentToken: authTokenRef.current ? authTokenRef.current.substring(0, 20) + '...' : 'null',
          isUpdating: isUpdatingAuthRef.current
        });

        // Only update if token has actually changed and not currently updating
        if (token !== authTokenRef.current && !isUpdatingAuthRef.current) {
          isUpdatingAuthRef.current = true;
          authTokenRef.current = token;

          // Update the socket auth and emit update event
          if (socketRef.current && token) {
            // 認証済みユーザーの名前を取得
            const displayName = user?.profile?.displayName || user?.email || 'User';

            // Update socket auth for future connections
            socketRef.current.auth = {
              ...socketRef.current.auth,
              token: token,
              name: displayName // 認証済みユーザーの名前を追加
            };

            // Always emit token update when socket exists (connected or connecting)
            console.log('[useSocket] Sending auth token update to server with token length:', token.length);
            socketRef.current.emit('update-auth', { token });

            // Set up response handlers for auth update
            socketRef.current.off('auth-updated');
            socketRef.current.off('auth-update-error');

            socketRef.current.on('auth-updated', (data) => {
              console.log('[useSocket] Auth successfully updated on server:', data);
              isUpdatingAuthRef.current = false; // Reset flag on success
            });

            socketRef.current.on('auth-update-error', (error) => {
              // Only log warning instead of error - this is not critical
              console.warn('[useSocket] Auth update failed (non-critical):', error);
              // Don't log sensitive token information
              isUpdatingAuthRef.current = false; // Reset flag on error
            });
          } else {
            console.warn('[useSocket] Cannot send auth update:', {
              hasSocket: !!socketRef.current,
              hasToken: !!token,
              socketConnected: socketRef.current?.connected
            });
            isUpdatingAuthRef.current = false; // Reset flag if conditions not met
          }
        } else {
          console.log('[useSocket] Skipping auth update:', {
            tokenChanged: token !== authTokenRef.current,
            isUpdating: isUpdatingAuthRef.current
          });
        }
      } catch (error) {
        console.error('[useSocket] Error updating auth token:', error);
        console.error('[useSocket] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        isUpdatingAuthRef.current = false; // Reset flag on error
      }
    };

    updateAuthToken();
  }, [user, loading, getAccessToken, isConnected]);

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