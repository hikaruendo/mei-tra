'use client';

import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '../auth/AuthModal';
import { useState } from 'react';
import styles from './UserProfile.module.scss';

export function UserProfile() {
  const { user, signOut, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <span className={styles.loadingText}>読み込み中...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowAuthModal(true)}
          className={styles.loginButton}
        >
          ログイン
        </button>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  return (
    <div className={styles.userContainer}>
      <div className={styles.userInfo}>
        <span className={styles.displayName}>
          {user.profile?.displayName || user.email}
        </span>
        <span className={styles.username}>
          @{user.profile?.username || 'ゲスト'}
        </span>
      </div>

      {user.profile && (
        <div className={styles.stats}>
          <div className={styles.statsRow}>勝利数: {user.profile.gamesWon}/{user.profile.gamesPlayed}</div>
          <div className={styles.statsRow}>スコア: {user.profile.totalScore}</div>
        </div>
      )}

      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className={styles.signOutButton}
      >
        {isSigningOut ? 'ログアウト中...' : 'ログアウト'}
      </button>
    </div>
  );
}