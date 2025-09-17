'use client';

import { useState } from 'react';
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
          setError('ユーザー名を入力してください');
          return;
        }
        if (!formData.displayName.trim()) {
          setError('表示名を入力してください');
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
          setError(null);
          // Show success message for email verification
          alert('確認メールを送信しました。メール内のリンクをクリックしてアカウントを有効化してください。');
        }
      }
    } catch {
      setError('予期しないエラーが発生しました');
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
      setError('メールアドレスを入力してください');
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
        setSuccessMessage('ログインリンクをメールで送信しました。メールをご確認ください。');
      }
    } catch (err) {
      console.error('Magic link error:', err);
      setError('予期しないエラーが発生しました');
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!formData.email.trim()) {
      setError('メールアドレスを入力してください');
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
        setSuccessMessage('パスワードリセットリンクをメールで送信しました。メールをご確認ください。');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError('予期しないエラーが発生しました');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>
          {mode === 'signin' ? 'ログイン' : '新規登録'}
        </h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>
              メールアドレス
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
              パスワード
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
                  ユーザー名
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
                  3-50文字の英数字と_のみ使用可能
                </p>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="displayName" className={styles.label}>
                  表示名
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
            {isSubmitting ? '処理中...' : mode === 'signin' ? 'ログイン' : '新規登録'}
          </button>
        </form>

        {mode === 'signin' && (
          <div className={styles.alternativeAuth}>
            <div className={styles.divider}>
              <span>または</span>
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={isSendingMagicLink || !formData.email.trim()}
              className={styles.magicLinkButton}
            >
              {isSendingMagicLink ? '送信中...' : 'メールでログイン'}
            </button>

            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={isSendingReset || !formData.email.trim()}
              className={styles.resetButton}
            >
              {isSendingReset ? '送信中...' : 'パスワードを忘れた場合'}
            </button>
          </div>
        )}

        <div className={styles.modeToggle}>
          <button
            type="button"
            onClick={() => onModeChange?.(mode === 'signin' ? 'signup' : 'signin')}
            className={styles.modeToggleButton}
          >
            {mode === 'signin'
              ? 'アカウントをお持ちでない方は新規登録'
              : 'すでにアカウントをお持ちの方はログイン'
            }
          </button>
        </div>
      </div>
    </div>
  );
}