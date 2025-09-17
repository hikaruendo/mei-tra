'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase';
import styles from './page.module.scss';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setIsValidSession(true);
      } else {
        setError('無効なリセットリンクです。再度パスワードリセットを申請してください。');
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      }
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください。');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Password update error:', error);
        setError('パスワードの更新に失敗しました。もう一度お試しください。');
      } else {
        // Password updated successfully
        alert('パスワードが更新されました。ログインページに移動します。');
        router.push('/auth/login');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('予期しないエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidSession && !error) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <h2>セッションを確認中...</h2>
        </div>
      </div>
    );
  }

  if (error && !isValidSession) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.error}>
            <h2>エラー</h2>
            <p>{error}</p>
            <p>ログインページに自動的に移動します...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>新しいパスワード設定</h2>
        <p>アカウントの新しいパスワードを入力してください。</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="password">新しいパスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="8文字以上のパスワード"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">パスワード確認</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="パスワードを再入力"
            />
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={styles.button}
          >
            {isLoading ? 'パスワード更新中...' : 'パスワードを更新'}
          </button>
        </form>
      </div>
    </div>
  );
}