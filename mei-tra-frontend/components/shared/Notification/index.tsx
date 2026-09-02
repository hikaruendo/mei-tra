import { useEffect, useRef } from 'react';
import styles from './index.module.scss';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
  persistent?: boolean;
  closeLabel?: string;
}

export const Notification = ({
  message,
  type,
  onClose,
  persistent = false,
  closeLabel = 'Close notification',
}: NotificationProps) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (persistent) return;

    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, persistent]);

  const bgColor = {
    success: 'success',
    error: 'error',
    warning: 'warning',
  }[type];
  return (
    <div
      className={`${styles.notification} ${bgColor} ${persistent ? styles.persistent : ''}`}
    >
      <span className={styles.message}>{message}</span>
      {persistent && (
        <button
          aria-label={closeLabel}
          className={styles.close}
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
};
