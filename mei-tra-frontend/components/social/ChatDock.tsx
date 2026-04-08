'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSocialSocket, useChatMessages } from '../../hooks/useSocialSocket';
import { ChatMessage } from './ChatMessage';
import { ChatComposer } from './ChatComposer';
import styles from './ChatDock.module.scss';

interface ChatDockProps {
  roomId: string;
  gameStarted?: boolean;
  gamePhase?: string | null;
}

export function ChatDock({ roomId, gameStarted = false, gamePhase }: ChatDockProps) {
  const t = useTranslations('chatDock');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const joinedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    if (isMinimized) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(e.target as Node)) {
        setIsMinimized(true);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMinimized]);

  const { isConnected, joinRoom, leaveRoom, sendMessage } = useSocialSocket();
  const { messages, typingUsers } = useChatMessages(roomId);

  useEffect(() => {
    if (!isConnected || !roomId) {
      return;
    }

    if (joinedRoomRef.current && joinedRoomRef.current !== roomId) {
      leaveRoom(joinedRoomRef.current);
      joinedRoomRef.current = null;
    }

    if (joinedRoomRef.current !== roomId) {
      joinRoom(roomId);
      joinedRoomRef.current = roomId;
    }
  }, [isConnected, roomId, joinRoom, leaveRoom]);

  useEffect(() => {
    return () => {
      if (joinedRoomRef.current) {
        leaveRoom(joinedRoomRef.current);
        joinedRoomRef.current = null;
      }
    };
  }, [leaveRoom]);

  // Auto-minimize chat when game starts
  useEffect(() => {
    if (gameStarted) {
      setIsMinimized(true);
    }
  }, [gameStarted]);

  // Auto-minimize chat on mobile during blow phase to prevent overlap with BlowControls
  useEffect(() => {
    if (gamePhase === 'blow' && window.innerWidth <= 768) {
      setIsMinimized(true);
    }
  }, [gamePhase]);

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
          {t('title')} {messages.length > 0 && `(${messages.length})`}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.chatDock} ref={chatRef}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={`${styles.statusIndicator} ${isConnected ? styles.connected : styles.disconnected}`} />
          <h3 className={styles.headerTitle}>{t('title')}</h3>
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
