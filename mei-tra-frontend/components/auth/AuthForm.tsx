'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { SignInData, SignUpData } from '@/types/user.types';
import { supabase } from '@/lib/supabase';
import {
  GUEST_NAME_MAX_LENGTH,
  normalizeGuestName,
  randomGuestNumber,
} from '@meitra/game-client/guest-name';
import styles from './AuthForm.module.scss';

interface AuthFormProps {
  mode: 'signin' | 'signup';
  onSuccess?: () => void;
  onModeChange?: (mode: 'signin' | 'signup') => void;
}

export function AuthForm({ mode, onSuccess, onModeChange }: AuthFormProps) {
  const { signIn, signUp, signInAnonymously, loading } = useAuth();
  const t = useTranslations('auth');
  const locale = useLocale();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);
  const [isSigningInAsGuest, setIsSigningInAsGuest] = useState(false);
  // Its own state rather than formData.displayName: that field is the signup
  // form's, and is only rendered in signup mode.
  const [guestName, setGuestName] = useState('');

  const localePrefix = locale === 'en' ? '/en' : '';
  const authCallbackUrl =
    typeof window === 'undefined'
      ? '/auth/callback'
      : `${window.location.origin}${localePrefix}/auth/callback`;
  const resetPasswordUrl =
    typeof window === 'undefined'
      ? '/auth/reset-password'
      : `${window.location.origin}${localePrefix}/auth/reset-password`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
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
        if (!formData.displayName.trim()) {
          setError(t('displayNameRequired'));
          return;
        }

        const { error } = await signUp({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
          locale: locale === 'en' ? 'en' : 'ja',
        } as SignUpData);

        if (error) {
          setError(error.message);
        } else {
          setSuccessMessage(t('confirmEmailSent'));
          setFormData(prev => ({
            ...prev,
            password: '',
          }));
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

  const handleGoogleAuth = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSigningInWithGoogle(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authCallbackUrl,
          scopes: 'openid email profile',
        },
      });

      if (error) {
        setError(error.message);
        setIsSigningInWithGoogle(false);
      }
    } catch (err) {
      console.error('Google auth error:', err);
      setError(t('unexpectedError'));
      setIsSigningInWithGoogle(false);
    }
  };

  const handleGuestSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSigningInAsGuest(true);

    try {
      const { error } = await signInAnonymously({
        displayName: normalizeGuestName(
          guestName,
          t('guestDefaultName', { number: randomGuestNumber() }),
        ),
        locale: locale === 'en' ? 'en' : 'ja',
      });

      if (error) {
        setError(error.message);
      } else {
        onSuccess?.();
      }
    } catch {
      setError(t('unexpectedError'));
    } finally {
      setIsSigningInAsGuest(false);
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
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: resetPasswordUrl
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
        <div className={styles.primaryAuth}>
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isSigningInWithGoogle || loading}
            className={styles.googleButton}
          >
            {!isSigningInWithGoogle && (
              <span className={styles.googleIcon} aria-hidden="true">
                <GoogleIcon />
              </span>
            )}
            {isSigningInWithGoogle ? t('processing') : t('continueWithGoogle')}
          </button>

          <div className={styles.fieldGroup}>
            <label htmlFor="guestName" className={styles.label}>
              {t('guestNameLabel')}
            </label>
            <input
              id="guestName"
              type="text"
              autoComplete="nickname"
              maxLength={GUEST_NAME_MAX_LENGTH}
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              placeholder={t('guestNamePlaceholder')}
              disabled={isSigningInAsGuest || loading}
              className={styles.input}
            />
          </div>

          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={isSigningInAsGuest || loading}
            className={styles.guestButton}
          >
            {isSigningInAsGuest ? t('processing') : t('continueAsGuest')}
          </button>
          <p className={styles.guestHint}>{t('guestHint')}</p>

          <div className={styles.divider}>
            <span>{t('or')}</span>
          </div>
        </div>

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
