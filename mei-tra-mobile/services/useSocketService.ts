import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.0.22:3333';
const RECONNECT_TOKEN_KEY = 'mei-tra-reconnect-token';
const PLAYER_NAME_KEY = 'mei-tra-player-name';

export function useSocketService() {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const isReconnecting = useRef(false);

  useEffect(() => {
    let socket: Socket;

    const initializeSocket = async () => {
      // Load saved data
      const [savedToken, savedName] = await Promise.all([
        AsyncStorage.getItem(RECONNECT_TOKEN_KEY),
        AsyncStorage.getItem(PLAYER_NAME_KEY)
      ]);
      
      if (savedToken) {
        setReconnectToken(savedToken);
      }
      if (savedName) {
        setPlayerName(savedName);
      }

      // Generate a temporary name if none exists
      const nameToUse = savedName || `Player_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create socket connection with auth
      socket = io(SOCKET_URL, {
        transports: ['polling', 'websocket'],
        autoConnect: true,
        timeout: 20000,
        forceNew: false,
        auth: {
          name: nameToUse,
          reconnectToken: savedToken,
        }
      });

      socketRef.current = socket;

      // Connection event handlers
      socket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        isReconnecting.current = false;
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        setIsConnected(false);
        
        // Attempt to reconnect unless it was a manual disconnect
        if (reason !== 'io client disconnect' && 
            reconnectAttempts.current < maxReconnectAttempts && 
            !isReconnecting.current) {
          
          isReconnecting.current = true;
          const delay = Math.min(2000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff with max 30s
          
          setTimeout(() => {
            reconnectAttempts.current++;
            console.log(`Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts}`);
            socket.connect();
          }, delay);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setIsConnected(false);
        isReconnecting.current = false;
      });

      // Reconnection event handlers
      socket.on('reconnect-token', async (data: { token: string } | string) => {
        console.log('Received reconnect token');
        const token = typeof data === 'string' ? data : data.token;
        setReconnectToken(token);
        await AsyncStorage.setItem(RECONNECT_TOKEN_KEY, token);
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

      socket.on('error-message', (message: string) => {
        console.error('Socket error:', message);
      });
    };

    initializeSocket();

    // Cleanup on unmount
    return () => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    };
  }, []); // Remove reconnectToken from dependencies to prevent recreation

  const setPlayerNameAndStore = async (name: string) => {
    setPlayerName(name);
    await AsyncStorage.setItem(PLAYER_NAME_KEY, name);
  };

  const clearReconnectToken = async () => {
    setReconnectToken(null);
    await AsyncStorage.removeItem(RECONNECT_TOKEN_KEY);
  };

  const clearPlayerData = async () => {
    setReconnectToken(null);
    setPlayerName(null);
    await Promise.all([
      AsyncStorage.removeItem(RECONNECT_TOKEN_KEY),
      AsyncStorage.removeItem(PLAYER_NAME_KEY)
    ]);
  };

  return {
    socket: socketRef.current,
    isConnected,
    reconnectToken,
    playerName,
    setPlayerNameAndStore,
    clearReconnectToken,
    clearPlayerData,
  };
}