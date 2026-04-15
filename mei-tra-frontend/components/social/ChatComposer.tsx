'use client';

import { useState, FormEvent } from 'react';
import { SendIcon } from '@/components/icons/UIIcons';
import styles from './ChatComposer.module.scss';

interface ChatComposerProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <div className={styles.composer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={disabled ? 'Connecting...' : 'Type a message...'}
          disabled={disabled}
          className={styles.input}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className={styles.sendButton}
        >
          <SendIcon className={styles.sendIcon} />
        </button>
      </form>
      <div className={styles.charCount}>
        {message.length}/500
      </div>
    </div>
  );
}
