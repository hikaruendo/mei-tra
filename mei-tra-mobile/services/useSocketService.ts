import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3333';
const RECONNECT_TOKEN_KEY = 'mei-tra-reconnect-token';

export function useSocketService() {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    let socket: Socket;

    const initializeSocket = async () => {
      // Load saved reconnect token
      const savedToken = await AsyncStorage.getItem(RECONNECT_TOKEN_KEY);
      if (savedToken) {
        setReconnectToken(savedToken);
      }

      // Create socket connection
      socket = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true,
        forceNew: true,
      });

      socketRef.current = socket;

      // Connection event handlers
      socket.on('connect', async () => {
        console.log('Connected to server');
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Attempt reconnection if we have a token
        if (reconnectToken) {
          socket.emit('reconnect-with-token', { token: reconnectToken });
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setIsConnected(false);
        
        // Attempt to reconnect unless it was a manual disconnect
        if (reason !== 'io client disconnect' && reconnectAttempts.current < maxReconnectAttempts) {
          setTimeout(() => {
            reconnectAttempts.current++;
            console.log(`Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts}`);
            socket.connect();
          }, 2000 * reconnectAttempts.current); // Exponential backoff
        }
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setIsConnected(false);
      });

      // Reconnection event handlers
      socket.on('reconnect-token', async (data: { token: string }) => {
        console.log('Received reconnect token');
        setReconnectToken(data.token);
        await AsyncStorage.setItem(RECONNECT_TOKEN_KEY, data.token);
      });

      socket.on('reconnect-success', (data: any) => {
        console.log('Reconnection successful');
        // Game state will be restored by the server
      });

      socket.on('reconnect-failed', async () => {
        console.log('Reconnection failed - clearing token');
        setReconnectToken(null);
        await AsyncStorage.removeItem(RECONNECT_TOKEN_KEY);
      });
    };

    initializeSocket();

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [reconnectToken]);

  const clearReconnectToken = async () => {
    setReconnectToken(null);
    await AsyncStorage.removeItem(RECONNECT_TOKEN_KEY);
  };

  return {
    socket: socketRef.current,
    isConnected,
    reconnectToken,
    clearReconnectToken,
  };
}