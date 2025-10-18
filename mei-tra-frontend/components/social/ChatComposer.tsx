'use client';

import { useState, FormEvent } from 'react';
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
          <svg className={styles.sendIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
      <div className={styles.charCount}>
        {message.length}/500
      </div>
    </div>
  );
}
