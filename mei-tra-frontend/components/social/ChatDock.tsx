'use client';

import type { ChatMessage as ChatMessageType } from '@contracts/social';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDownIcon } from '@/components/icons/UIIcons';
import { useSocialSocket, useChatMessages } from '@/hooks/useSocialSocket';
import { useAuth } from '@/hooks/useAuth';
import { ChatMessage } from '@/components/social/ChatMessage';
import { ChatComposer } from '@/components/social/ChatComposer';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import styles from './ChatDock.module.scss';

interface ChatDockProps {
  roomId: string;
  gameStarted?: boolean;
  gamePhase?: string | null;
  placement?: 'default' | 'topbar' | 'menu';
}

type ModerationTarget = {
  kind: 'report' | 'block';
  message: ChatMessageType;
};

export function ChatDock({
  roomId,
  gameStarted = false,
  gamePhase,
  placement = 'default',
}: ChatDockProps) {
  const t = useTranslations('chatDock');
  const { user } = useAuth();
  const [isMinimized, setIsMinimized] = useState(gameStarted);
  const [moderationTarget, setModerationTarget] = useState<ModerationTarget | null>(null);
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

  const {
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    reportMessage,
    blockUser,
    unblockUser,
  } = useSocialSocket();
  const { messages, typingUsers, blockedUsers, notice, clearNotice } = useChatMessages(roomId);

  useEffect(() => {
    if (isMinimized) setModerationTarget(null);
  }, [isMinimized]);

  useEffect(() => {
    if (!isConnected || !roomId) {
      joinedRoomRef.current = null;
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
    clearNotice();
    sendMessage(roomId, content);
  };

  const handleConfirmModeration = () => {
    if (!moderationTarget || !isConnected) {
      setModerationTarget(null);
      return;
    }
    clearNotice();
    if (moderationTarget.kind === 'report') {
      reportMessage(roomId, moderationTarget.message.id);
    } else {
      blockUser(moderationTarget.message.sender.userId);
    }
    setModerationTarget(null);
  };

  return (
    <div className={styles.chatShell} ref={chatRef}>
      <button
        onClick={() => setIsMinimized((current) => !current)}
        className={`${styles.minimizedButton} ${!isMinimized ? styles.minimizedButtonActive : ''}`}
        aria-expanded={!isMinimized}
      >
        {t('title')} {messages.length > 0 && `(${messages.length})`}
      </button>

      {!isMinimized && (
        <div
          className={`${styles.chatDock} ${placement === 'topbar' ? styles.topbar : ''} ${placement === 'menu' ? styles.menu : ''}`}
        >
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
              <ChevronDownIcon className={styles.icon} />
            </button>
          </div>

          {notice ? (
            <div className={styles.notice} role={notice === 'error' ? 'alert' : 'status'}>
              {t(notice)}
            </div>
          ) : null}

          {blockedUsers.length > 0 ? (
            <details className={styles.blockedUsers}>
              <summary>{t('blockedCount', { count: blockedUsers.length })}</summary>
              <div className={styles.blockedUserList}>
                {blockedUsers.map((blocked) => (
                  <button
                    key={blocked.userId}
                    type="button"
                    disabled={!isConnected}
                    onClick={() => {
                      clearNotice();
                      unblockUser(blocked.userId);
                    }}
                  >
                    {t('unblockUser', { name: blocked.displayName })}
                  </button>
                ))}
              </div>
            </details>
          ) : null}

          {/* Messages */}
          <div className={styles.messagesContainer}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                {t('empty')}
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessage
                  key={msg.message.id}
                  message={msg.message}
                  ownUserId={user?.id}
                  disabled={!isConnected}
                  onReport={(message) => setModerationTarget({ kind: 'report', message })}
                  onBlock={(message) => setModerationTarget({ kind: 'block', message })}
                />
              ))
            )}
            {typingUsers.size > 0 && (
              <div className={styles.typingIndicator}>
                {typingUsers.size === 1
                  ? t('typingOne')
                  : t('typingMany', { count: typingUsers.size })}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <ChatComposer
            onSend={handleSendMessage}
            disabled={!isConnected}
            connectingPlaceholder={t('connectingPlaceholder')}
            inputPlaceholder={t('inputPlaceholder')}
          />
        </div>
      )}
      <ConfirmModal
        isOpen={Boolean(moderationTarget)}
        title={moderationTarget ? t(moderationTarget.kind) : ''}
        message={moderationTarget ? t(
          moderationTarget.kind === 'report' ? 'reportConfirm' : 'blockConfirm',
          { name: moderationTarget.message.sender.displayName },
        ) : ''}
        confirmText={moderationTarget ? t(moderationTarget.kind) : ''}
        onConfirm={handleConfirmModeration}
        onCancel={() => setModerationTarget(null)}
      />
    </div>
  );
}
