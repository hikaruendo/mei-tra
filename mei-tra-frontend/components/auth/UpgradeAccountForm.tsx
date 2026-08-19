'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import styles from './AuthForm.module.scss';

interface UpgradeAccountFormProps {
  onUpgraded?: () => void;
}

export function UpgradeAccountForm({ onUpgraded }: UpgradeAccountFormProps) {
  const { upgradeAccount } = useAuth();
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setError(t('upgrade.passwordTooShort'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { error, confirmationRequired } = await upgradeAccount({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage(
          confirmationRequired
            ? t('upgrade.confirmEmailSent')
            : t('upgrade.completed'),
        );
        setPassword('');
        onUpgraded?.();
      }
    } catch {
      setError(t('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <div className={styles.form}>
        <div className={styles.success} role="status">
          {successMessage}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <p className={styles.helperText}>{t('upgrade.description')}</p>

      <div className={styles.fieldGroup}>
        <label htmlFor="upgrade-email" className={styles.label}>
          {t('email')}
        </label>
        <input
          id="upgrade-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="upgrade-password" className={styles.label}>
          {t('password')}
        </label>
        <input
          id="upgrade-password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder={t('upgrade.passwordHint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
          disabled={isSubmitting}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button
        type="submit"
        disabled={isSubmitting}
        className={styles.submitButton}
      >
        {isSubmitting ? t('processing') : t('upgrade.submit')}
      </button>
    </form>
  );
}
