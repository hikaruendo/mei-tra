'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase';
import styles from './page.module.scss';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient();

        // Get the code from URL
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          setError('認証エラーが発生しました。もう一度お試しください。');
          setIsLoading(false);
          return;
        }

        if (session) {
          // Authentication successful, redirect to home
          router.push('/');
        } else {
          // No session found, might be an invalid or expired link
          setError('リンクが無効または期限切れです。もう一度ログインしてください。');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error during auth callback:', err);
        setError('予期しないエラーが発生しました。');
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [router]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.spinner} />
          <h2>認証中...</h2>
          <p>少々お待ちください</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.error}>
            <h2>エラー</h2>
            <p>{error}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className={styles.button}
            >
              ログインページへ戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}