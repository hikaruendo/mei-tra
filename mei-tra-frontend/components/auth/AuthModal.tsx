'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AuthForm } from '@/components/auth/AuthForm';
import { GuestSignInForm } from '@/components/auth/GuestSignInForm';
import styles from './AuthModal.module.scss';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  onSuccess?: () => void;
}

// 'guest' is a step of this modal rather than a modal of its own: the auth
// modal is already open when the guest button is pressed, and stacking a
// second overlay on top of it reads as a mistake.
type AuthModalView = 'signin' | 'signup' | 'guest';

const titleKeys: Record<AuthModalView, 'login' | 'signup' | 'guestTitle'> = {
  signin: 'login',
  signup: 'signup',
  guest: 'guestTitle',
};

export function AuthModal({ isOpen, onClose, initialMode = 'signin', onSuccess }: AuthModalProps) {
  const t = useTranslations('auth');
  const [view, setView] = useState<AuthModalView>(initialMode);

  useEffect(() => {
    setView(initialMode);
  }, [initialMode]);

  // Reopening always starts from the mode the caller asked for, never on the
  // guest step the last visit happened to end on.
  useEffect(() => {
    if (!isOpen) {
      setView(initialMode);
    }
  }, [isOpen, initialMode]);

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          {view === 'guest' ? (
            <button
              type="button"
              onClick={() => setView('signin')}
              className={styles.backButton}
              aria-label={t('back')}
            >
              ←
            </button>
          ) : null}
          <h2 className={styles.title}>{t(titleKeys[view])}</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          {view === 'guest' ? (
            <GuestSignInForm onSuccess={handleSuccess} />
          ) : (
            <AuthForm
              mode={view}
              onSuccess={handleSuccess}
              onModeChange={setView}
              onGuestRequested={() => setView('guest')}
            />
          )}
        </div>
      </div>
    </div>
  );
}