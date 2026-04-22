import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import type {
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
      if (socket) {
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
      if (socket) {
        socket.emit('chat:typing', { roomId });
      }
    },
    [socket],
  );

  const loadMessages = useCallback(
    (roomId: string, limit?: number, cursor?: string) => {
      if (socket) {
        socket.emit('chat:list-messages', { roomId, limit, cursor });
      }
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
  };
}

export function useChatMessages(roomId: string) {
  const { socket, loadMessages } = useSocialSocket();
  const [messages, setMessages] = useState<ChatMessageEvent[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) {
      return;
    }

    // Auto-load recent messages when joining a room
    loadMessages(roomId, 50);

    const handleMessage = (event: ChatMessageEvent) => {
      if (event.roomId === roomId) {
        setMessages((prev) => [...prev, event]);
      }
    };

    const handleTyping = (event: ChatTypingEvent) => {
      if (event.roomId === roomId) {
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
        const events: ChatMessageEvent[] = data.messages.map((msg) => ({
          type: 'chat.message',
          roomId: data.roomId,
          message: msg,
        }));
        setMessages(events);
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:messages', handleMessages);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:messages', handleMessages);
    };
  }, [socket, roomId, loadMessages]);

  return { messages, typingUsers, loadMessages };
}
