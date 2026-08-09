import type {
  ChatMessage,
  ChatMessageEvent,
  ChatMessagesPayload,
  ChatTypingEvent,
} from '@meitra/contracts/social';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '@/context/AuthContext';
import { config } from '@/lib/config';

interface SocialContextValue {
  connected: boolean;
  messages: ChatMessage[];
  typingUserIds: string[];
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string) => void;
  sendTyping: (roomId: string) => void;
  loadMessages: (roomId: string, limit?: number) => void;
}

const SocialContext = createContext<SocialContextValue>({
  connected: false,
  messages: [],
  typingUserIds: [],
  joinRoom: () => {},
  leaveRoom: () => {},
  sendMessage: () => {},
  sendTyping: () => {},
  loadMessages: () => {},
});

export function useSocial() {
  return useContext(SocialContext);
}

const TYPING_TIMEOUT_MS = 3000;

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { session, getAccessToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingMap, setTypingMap] = useState<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const joinedRoomRef = useRef<string | null>(null);

  const typingUserIds = useMemo(
    () => Array.from(typingMap.keys()),
    [typingMap],
  );

  useEffect(() => {
    const hasSession = session?.access_token;
    if (!hasSession) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      setMessages([]);
      return;
    }

    const socket = io(`${config.backendUrl}/social`, {
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      auth: async (callback) => {
        const token = await getAccessToken();
        callback({ token: token ?? undefined });
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (joinedRoomRef.current) {
        socket.emit('chat:join-room', { roomId: joinedRoomRef.current });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('chat:message', (event: ChatMessageEvent) => {
      if (event.roomId === joinedRoomRef.current) {
        setMessages((prev) => [...prev, event.message]);
      }
    });

    socket.on('chat:messages', (payload: ChatMessagesPayload) => {
      if (payload.roomId === joinedRoomRef.current) {
        setMessages(payload.messages);
      }
    });

    socket.on('chat:typing', (event: ChatTypingEvent) => {
      if (event.roomId !== joinedRoomRef.current) return;
      setTypingMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.userId);
        if (existing) clearTimeout(existing);
        next.set(
          event.userId,
          setTimeout(() => {
            setTypingMap((m) => {
              const updated = new Map(m);
              updated.delete(event.userId);
              return updated;
            });
          }, TYPING_TIMEOUT_MS),
        );
        return next;
      });
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [session?.access_token, getAccessToken]);

  const joinRoom = useCallback((roomId: string) => {
    joinedRoomRef.current = roomId;
    setMessages([]);
    setTypingMap(new Map());
    socketRef.current?.emit('chat:join-room', { roomId });
    socketRef.current?.emit('chat:list-messages', { roomId, limit: 50 });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('chat:leave-room', { roomId });
    if (joinedRoomRef.current === roomId) {
      joinedRoomRef.current = null;
      setMessages([]);
      setTypingMap(new Map());
    }
  }, []);

  const sendMessage = useCallback((roomId: string, content: string) => {
    socketRef.current?.emit('chat:post-message', {
      roomId,
      content,
      contentType: 'text',
    });
  }, []);

  const sendTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('chat:typing', { roomId });
  }, []);

  const loadMessages = useCallback((roomId: string, limit = 50) => {
    socketRef.current?.emit('chat:list-messages', { roomId, limit });
  }, []);

  const value = useMemo<SocialContextValue>(
    () => ({
      connected,
      messages,
      typingUserIds,
      joinRoom,
      leaveRoom,
      sendMessage,
      sendTyping,
      loadMessages,
    }),
    [
      connected,
      messages,
      typingUserIds,
      joinRoom,
      leaveRoom,
      sendMessage,
      sendTyping,
      loadMessages,
    ],
  );

  return (
    <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
  );
}
