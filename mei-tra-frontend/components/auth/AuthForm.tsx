'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { SignInData, SignUpData } from '@/types/user.types';
import styles from './AuthForm.module.scss';

interface AuthFormProps {
  mode: 'signin' | 'signup';
  onSuccess?: () => void;
  onModeChange?: (mode: 'signin' | 'signup') => void;
}

export function AuthForm({ mode, onSuccess, onModeChange }: AuthFormProps) {
  const { signIn, signUp, loading } = useAuth();
  const t = useTranslations('auth');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn({
          email: formData.email,
          password: formData.password,
        } as SignInData);

        if (error) {
          setError(error.message);
        } else {
          onSuccess?.();
        }
      } else {
        // Validate signup data
        if (!formData.username.trim()) {
          setError(t('usernameRequired'));
          return;
        }
        if (!formData.displayName.trim()) {
          setError(t('displayNameRequired'));
          return;
        }

        const { error } = await signUp({
          email: formData.email,
          password: formData.password,
          username: formData.username,
          displayName: formData.displayName,
        } as SignUpData);

        if (error) {
          setError(error.message);
        } else {
          onSuccess?.();
        }
      }
    } catch {
      setError(t('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMagicLink = async () => {
    if (!formData.email.trim()) {
      setError(t('emailRequired'));
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSendingMagicLink(true);

    try {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage(t('magicLinkSent'));
      }
    } catch (err) {
      console.error('Magic link error:', err);
      setError(t('unexpectedError'));
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!formData.email.trim()) {
      setError(t('emailRequired'));
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSendingReset(true);

    try {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage(t('passwordResetSent'));
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError(t('unexpectedError'));
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className={styles.input}
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="password" className={styles.label}>
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={handleInputChange}
              className={styles.input}
              disabled={isSubmitting}
            />
          </div>

          {mode === 'signup' && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="username" className={styles.label}>
                  {t('username')}
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  value={formData.username}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled={isSubmitting}
                />
                <p className={styles.helperText}>
                  {t('usernameHelper')}
                </p>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="displayName" className={styles.label}>
                  {t('displayName')}
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  maxLength={100}
                  value={formData.displayName}
                  onChange={handleInputChange}
                  className={styles.input}
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          {successMessage && (
            <div className={styles.success}>
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className={styles.submitButton}
          >
            {isSubmitting ? t('processing') : mode === 'signin' ? t('login') : t('signup')}
          </button>
        </form>

        {mode === 'signin' && (
          <div className={styles.alternativeAuth}>
            <div className={styles.divider}>
              <span>{t('or')}</span>
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={isSendingMagicLink || !formData.email.trim()}
              className={styles.magicLinkButton}
            >
              {isSendingMagicLink ? t('sending') : t('loginWithEmail')}
            </button>

            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={isSendingReset || !formData.email.trim()}
              className={styles.resetButton}
            >
              {isSendingReset ? t('sending') : t('forgotPassword')}
            </button>
          </div>
        )}

        <div className={styles.modeToggle}>
          <button
            type="button"
            onClick={() => onModeChange?.(mode === 'signin' ? 'signup' : 'signin')}
            className={styles.modeToggleButton}
          >
            {mode === 'signin' ? t('noAccount') : t('hasAccount')}
          </button>
        </div>
      </div>
    </div>
  );
}