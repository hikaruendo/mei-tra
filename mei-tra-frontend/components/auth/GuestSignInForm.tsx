'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import {
  GUEST_NAME_MAX_LENGTH,
  normalizeGuestName,
  randomGuestNumber,
} from '@meitra/game-client/guest-name';
import styles from './AuthForm.module.scss';

interface GuestSignInFormProps {
  onSuccess?: () => void;
}

/**
 * The one place a guest account is created. Both entry points — the landing
 * page's own modal and the guest step inside the auth modal — render this, so
 * the name handling and the sign-in call have a single owner.
 */
export function GuestSignInForm({ onSuccess }: GuestSignInFormProps) {
  const { signInAnonymously, loading } = useAuth();
  const t = useTranslations('auth');
  const locale = useLocale();
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const { error: signInError } = await signInAnonymously({
        displayName: normalizeGuestName(
          guestName,
          t('guestDefaultName', { number: randomGuestNumber() }),
        ),
        locale: locale === 'en' ? 'en' : 'ja',
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      onSuccess?.();
    } catch {
      setError(t('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || loading;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.fieldGroup}>
        <label htmlFor="guestName" className={styles.label}>
          {t('guestNameLabel')}
        </label>
        <input
          id="guestName"
          type="text"
          autoComplete="nickname"
          autoFocus
          maxLength={GUEST_NAME_MAX_LENGTH}
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
          placeholder={t('guestNamePlaceholder')}
          disabled={isBusy}
          className={styles.input}
        />
      </div>

      <button type="submit" disabled={isBusy} className={styles.submitButton}>
        {isSubmitting ? t('processing') : t('guestStart')}
      </button>

      <p className={styles.guestHint}>{t('guestHint')}</p>
    </form>
  );
}
