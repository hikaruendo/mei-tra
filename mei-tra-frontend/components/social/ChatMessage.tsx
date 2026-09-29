'use client';

import type { ChatMessage as ChatMessageType } from '@contracts/social';
import { useTranslations } from 'next-intl';
import styles from './ChatMessage.module.scss';

interface ChatMessageProps {
  message: ChatMessageType;
  ownUserId?: string;
  disabled?: boolean;
  onReport?: (message: ChatMessageType) => void;
  onBlock?: (message: ChatMessageType) => void;
}

export function ChatMessage({
  message,
  ownUserId,
  disabled = false,
  onReport,
  onBlock,
}: ChatMessageProps) {
  const t = useTranslations('chatDock');
  const isSystem = message.contentType === 'system';

  if (isSystem) {
    return (
      <div className={styles.systemMessage}>
        {message.content}
      </div>
    );
  }

  return (
    <div className={styles.message}>
      {/* Avatar */}
      <div className={styles.avatar}>
        {message.sender.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.sender.avatarUrl}
            alt={message.sender.displayName}
            className={styles.avatarImage}
          />
        ) : (
          <div className={styles.avatarFallback}>
            {message.sender.displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.senderName} title={message.sender.displayName}>
            {message.sender.displayName}
          </span>
          <span className={styles.timestamp}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <p className={styles.text}>
          {message.content}
        </p>
        {ownUserId && message.sender.userId !== ownUserId && onReport && onBlock ? (
          <div className={styles.actions}>
            <button type="button" disabled={disabled} onClick={() => onReport(message)}>
              {t('report')}
            </button>
            <button type="button" disabled={disabled} onClick={() => onBlock(message)}>
              {t('block')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
