import { useEffect } from 'react';
import styles from './index.module.css';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}

export const Notification = ({ message, type, onClose }: NotificationProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'success',
    error: 'error',
    warning: 'warning',
  }[type];

  return (
    <div 
      className={`${styles.notification} ${bgColor}`}
    >
      {message}
    </div>
  );
}; 