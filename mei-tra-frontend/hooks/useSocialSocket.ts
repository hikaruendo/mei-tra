import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type {
  ChatBlockedUser,
  ChatBlockedUsersPayload,
  ChatMessageEvent,
  ChatMessagesPayload,
  ChatTypingEvent,
} from '@contracts/social';
import { useSocialSocketContext } from '../contexts/SocialSocketContext';

export interface UseSocialSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string, replyTo?: string) => void;
  sendTyping: (roomId: string) => void;
  loadMessages: (roomId: string, limit?: number, cursor?: string) => void;
  reportMessage: (roomId: string, messageId: string) => void;
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
}

export function useSocialSocket(): UseSocialSocketReturn {
  const { socket, isConnected } = useSocialSocketContext();

  const joinRoom = useCallback(
    (roomId: string) => {
      if (socket?.connected) {
        socket.emit('chat:join-room', { roomId });
      }
    },
    [socket],
  );

  const leaveRoom = useCallback(
    (roomId: string) => {
      if (socket?.connected) {
        socket.emit('chat:leave-room', { roomId });
      }
    },
    [socket],
  );

  const sendMessage = useCallback(
    (roomId: string, content: string, replyTo?: string) => {
      if (socket?.connected) {
        socket.emit('chat:post-message', {
          roomId,
          content,
          contentType: 'text',
          replyTo,
        });
      }
    },
    [socket],
  );

  const sendTyping = useCallback(
    (roomId: string) => {
      if (socket?.connected) {
        socket.emit('chat:typing', { roomId });
      }
    },
    [socket],
  );

  const loadMessages = useCallback(
    (roomId: string, limit?: number, cursor?: string) => {
      if (socket?.connected) {
        socket.emit('chat:list-messages', { roomId, limit, cursor });
      }
    },
    [socket],
  );

  const reportMessage = useCallback(
    (roomId: string, messageId: string) => {
      if (socket?.connected) {
        socket.emit('chat:report-message', {
          roomId,
          messageId,
          reason: 'offensive',
        });
      }
    },
    [socket],
  );

  const blockUser = useCallback(
    (userId: string) => {
      if (socket?.connected) socket.emit('chat:block-user', { userId });
    },
    [socket],
  );

  const unblockUser = useCallback(
    (userId: string) => {
      if (socket?.connected) socket.emit('chat:unblock-user', { userId });
    },
    [socket],
  );

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    sendTyping,
    loadMessages,
    reportMessage,
    blockUser,
    unblockUser,
  };
}

export function useChatMessages(roomId: string) {
  const { socket, isConnected, loadMessages } = useSocialSocket();
  const [messages, setMessages] = useState<ChatMessageEvent[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<ChatBlockedUser[]>([]);
  const [notice, setNotice] = useState<
    'reported' | 'blocked' | 'unblocked' | 'filtered' | 'error' | null
  >(null);
  const blockedUserIds = useRef(new Set<string>());
  const clearNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    setMessages([]);
    setTypingUsers(new Set());
    setNotice(null);
  }, [roomId]);

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    // Auto-load recent messages when joining a room
    loadMessages(roomId, 50);

    const handleMessage = (event: ChatMessageEvent) => {
      if (
        event.roomId === roomId &&
        !blockedUserIds.current.has(event.message.sender.userId)
      ) {
        setMessages((prev) => [...prev, event]);
      }
    };

    const handleTyping = (event: ChatTypingEvent) => {
      if (event.roomId === roomId && !blockedUserIds.current.has(event.userId)) {
        setTypingUsers((prev) => new Set(prev).add(event.userId));
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(event.userId);
            return next;
          });
        }, 3000);
      }
    };

    const handleMessages = (data: ChatMessagesPayload) => {
      if (data.roomId === roomId) {
        console.log('[useChatMessages] Loaded messages:', data.messages);
        const events: ChatMessageEvent[] = data.messages
          .filter((msg) => !blockedUserIds.current.has(msg.sender.userId))
          .map((msg) => ({
            type: 'chat.message',
            roomId: data.roomId,
            message: msg,
          }));
        setMessages(events);
      }
    };

    const handleBlockedUsers = (payload: ChatBlockedUsersPayload) => {
      const nextBlocked = new Set(payload.users.map((user) => user.userId));
      const wasUnblocked = [...blockedUserIds.current].some(
        (userId) => !nextBlocked.has(userId),
      );
      blockedUserIds.current = nextBlocked;
      setBlockedUsers(payload.users);
      setMessages((current) =>
        current.filter((event) => !nextBlocked.has(event.message.sender.userId)),
      );
      setTypingUsers((current) => new Set(
        [...current].filter((userId) => !nextBlocked.has(userId)),
      ));
      if (wasUnblocked) loadMessages(roomId, 50);
    };

    const handleError = (payload: { code?: string }) => {
      setNotice(payload?.code === 'CONTENT_REJECTED' ? 'filtered' : 'error');
    };
    const handleReported = () => setNotice('reported');
    const handleBlocked = () => setNotice('blocked');
    const handleUnblocked = () => setNotice('unblocked');

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:messages', handleMessages);
    socket.on('chat:blocked-users', handleBlockedUsers);
    socket.on('chat:reported', handleReported);
    socket.on('chat:blocked', handleBlocked);
    socket.on('chat:unblocked', handleUnblocked);
    socket.on('chat:error', handleError);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:messages', handleMessages);
      socket.off('chat:blocked-users', handleBlockedUsers);
      socket.off('chat:reported', handleReported);
      socket.off('chat:blocked', handleBlocked);
      socket.off('chat:unblocked', handleUnblocked);
      socket.off('chat:error', handleError);
    };
  }, [socket, isConnected, roomId, loadMessages]);

  return { messages, typingUsers, blockedUsers, notice, clearNotice, loadMessages };
}
