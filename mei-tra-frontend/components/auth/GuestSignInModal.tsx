'use client';

import { useTranslations } from 'next-intl';
import { GuestSignInForm } from './GuestSignInForm';
import styles from './AuthModal.module.scss';

interface GuestSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GuestSignInModal({
  isOpen,
  onClose,
  onSuccess,
}: GuestSignInModalProps) {
  const t = useTranslations('auth');

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('guestTitle')}</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <GuestSignInForm
            onSuccess={() => {
              onSuccess?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
