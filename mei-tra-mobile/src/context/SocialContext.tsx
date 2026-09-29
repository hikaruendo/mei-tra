import type {
  ChatBlockedUser,
  ChatBlockedUsersPayload,
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
  blockedUserIds: string[];
  blockedUsers: ChatBlockedUser[];
  notice: 'reported' | 'blocked' | 'unblocked' | 'filtered' | 'error' | null;
  typingUserIds: string[];
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string) => void;
  sendTyping: (roomId: string) => void;
  loadMessages: (roomId: string, limit?: number) => void;
  reportMessage: (roomId: string, messageId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
}

const SocialContext = createContext<SocialContextValue>({
  connected: false,
  messages: [],
  blockedUserIds: [],
  blockedUsers: [],
  notice: null,
  typingUserIds: [],
  joinRoom: () => {},
  leaveRoom: () => {},
  sendMessage: () => {},
  sendTyping: () => {},
  loadMessages: () => {},
  reportMessage: () => {},
  blockUser: () => {},
  unblockUser: () => {},
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
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<ChatBlockedUser[]>([]);
  const blockedRef = useRef(new Set<string>());
  const [notice, setNotice] = useState<SocialContextValue['notice']>(null);
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
      setBlockedUserIds([]);
      setBlockedUsers([]);
      blockedRef.current = new Set();
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
      if (event.roomId === joinedRoomRef.current &&
          !blockedRef.current.has(event.message.sender.userId)) {
        setMessages((prev) => [...prev, event.message]);
      }
    });

    socket.on('chat:messages', (payload: ChatMessagesPayload) => {
      if (payload.roomId === joinedRoomRef.current) {
        setMessages(payload.messages.filter((message) =>
          !blockedRef.current.has(message.sender.userId),
        ));
      }
    });

    socket.on('chat:blocked-users', (payload: ChatBlockedUsersPayload) => {
      const nextBlocked = new Set(payload.users.map((item) => item.userId));
      const wasUnblocked = [...blockedRef.current].some((id) => !nextBlocked.has(id));
      blockedRef.current = nextBlocked;
      setBlockedUsers(payload.users);
      setBlockedUserIds([...nextBlocked]);
      setMessages((current) => current.filter((message) =>
        !nextBlocked.has(message.sender.userId),
      ));
      if (wasUnblocked && joinedRoomRef.current) {
        socket.emit('chat:list-messages', { roomId: joinedRoomRef.current, limit: 50 });
      }
    });
    socket.on('chat:blocked', () => setNotice('blocked'));
    socket.on('chat:unblocked', () => setNotice('unblocked'));
    socket.on('chat:reported', () => setNotice('reported'));
    socket.on('chat:error', (payload: { code?: string }) =>
      setNotice(payload?.code === 'CONTENT_REJECTED' ? 'filtered' : 'error'));

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
    setNotice(null);
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

  const reportMessage = useCallback((roomId: string, messageId: string) => {
    setNotice(null);
    socketRef.current?.emit('chat:report-message', {
      roomId,
      messageId,
      reason: 'offensive',
    });
  }, []);

  const blockUser = useCallback((userId: string) => {
    setNotice(null);
    socketRef.current?.emit('chat:block-user', { userId });
  }, []);

  const unblockUser = useCallback((userId: string) => {
    setNotice(null);
    socketRef.current?.emit('chat:unblock-user', { userId });
  }, []);

  const value = useMemo<SocialContextValue>(
    () => ({
      connected,
      messages,
      blockedUserIds,
      blockedUsers,
      notice,
      typingUserIds,
      joinRoom,
      leaveRoom,
      sendMessage,
      sendTyping,
      loadMessages,
      reportMessage,
      blockUser,
      unblockUser,
    }),
    [
      connected,
      messages,
      blockedUserIds,
      blockedUsers,
      notice,
      typingUserIds,
      joinRoom,
      leaveRoom,
      sendMessage,
      sendTyping,
      loadMessages,
      reportMessage,
      blockUser,
      unblockUser,
    ],
  );

  return (
    <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
  );
}
