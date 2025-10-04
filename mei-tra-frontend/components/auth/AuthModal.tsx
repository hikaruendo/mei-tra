'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AuthForm } from './AuthForm';
import styles from './AuthModal.module.scss';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, initialMode = 'signin', onSuccess }: AuthModalProps) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {mode === 'signin' ? t('login') : t('signup')}
          </h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <AuthForm
            mode={mode}
            onSuccess={handleSuccess}
            onModeChange={setMode}
          />
        </div>
      </div>
    </div>
  );
}