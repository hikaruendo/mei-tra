'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocialSocket, useChatMessages } from '../../hooks/useSocialSocket';
import { ChatMessage } from './ChatMessage';
import { ChatComposer } from './ChatComposer';
import styles from './ChatDock.module.scss';

interface ChatDockProps {
  roomId: string;
  gameStarted?: boolean;
}

export function ChatDock({ roomId, gameStarted = false }: ChatDockProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, joinRoom, leaveRoom, sendMessage } = useSocialSocket();
  const { messages, typingUsers } = useChatMessages(roomId);

  useEffect(() => {
    if (isConnected && roomId) {
      joinRoom(roomId);
      return () => {
        leaveRoom(roomId);
      };
    }
  }, [isConnected, roomId, joinRoom, leaveRoom]);

  // Auto-minimize chat when game starts
  useEffect(() => {
    if (gameStarted) {
      setIsMinimized(true);
    }
  }, [gameStarted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (content: string) => {
    sendMessage(roomId, content);
  };

  if (isMinimized) {
    return (
      <div className={styles.minimized}>
        <button
          onClick={() => setIsMinimized(false)}
          className={styles.minimizedButton}
        >
          Chat {messages.length > 0 && `(${messages.length})`}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.chatDock}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={`${styles.statusIndicator} ${isConnected ? styles.connected : styles.disconnected}`} />
          <h3 className={styles.headerTitle}>Chat</h3>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className={styles.minimizeButton}
        >
          <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage key={msg.message.id} message={msg.message} />
          ))
        )}
        {typingUsers.size > 0 && (
          <div className={styles.typingIndicator}>
            {typingUsers.size === 1 ? 'Someone is' : `${typingUsers.size} people are`} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <ChatComposer onSend={handleSendMessage} disabled={!isConnected} />
    </div>
  );
}
