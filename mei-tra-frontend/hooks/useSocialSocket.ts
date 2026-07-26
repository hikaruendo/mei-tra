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
  const { socket, isConnected, loadMessages } = useSocialSocket();
  const [messages, setMessages] = useState<ChatMessageEvent[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    const handleMessage = (event: ChatMessageEvent) => {
      if (event.roomId === roomId) {
        setMessages((prev) => {
          if (prev.some((item) => item.message.id === event.message.id)) {
            return prev;
          }

          return [...prev, event];
        });
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
        setMessages((prev) => {
          const messagesById = new Map(
            prev.map((event) => [event.message.id, event]),
          );
          events.forEach((event) => messagesById.set(event.message.id, event));

          return Array.from(messagesById.values()).sort(
            (left, right) =>
              new Date(left.message.createdAt).getTime() -
              new Date(right.message.createdAt).getTime(),
          );
        });
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:messages', handleMessages);

    // Register listeners before requesting history so a live message cannot
    // arrive during the request and then be overwritten by the response.
    loadMessages(roomId, 50);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:messages', handleMessages);
    };
  }, [socket, isConnected, roomId, loadMessages]);

  return { messages, typingUsers, loadMessages };
}
