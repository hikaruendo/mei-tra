'use client';

import { ChatMessage as ChatMessageType } from '../../types/social.types';
import styles from './ChatMessage.module.scss';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
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
          <span className={styles.senderName}>
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
      </div>
    </div>
  );
}
