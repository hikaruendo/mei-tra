'use client';

import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '../auth/AuthModal';
import { useState } from 'react';
import styles from './ProfilePage.module.scss';

export function ProfilePage() {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingSpinner}></div>
          <span className={styles.loadingText}>プロフィールを読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.noAuthContainer}>
        <div className={styles.noAuthContent}>
          <div>
            <h2 className={styles.noAuthTitle}>プロフィール</h2>
            <p className={styles.noAuthDescription}>
              プロフィールを表示するにはログインが必要です
            </p>
          </div>
          <div className={styles.noAuthButtonContainer}>
            <button
              onClick={() => setShowAuthModal(true)}
              className={styles.loginButton}
            >
              ログイン
            </button>
          </div>
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        </div>
      </div>
    );
  }

  const profile = user.profile;
  const winRate = profile?.gamesPlayed ? (profile.gamesWon / profile.gamesPlayed * 100).toFixed(1) : '0.0';

  return (
    <div className={styles.container}>
      <div className={styles.mainContainer}>
        <div className={styles.profileCard}>
          {/* Profile Header */}
          <div className={styles.profileHeader}>
            <div className={styles.profileHeaderContent}>
              <div className={styles.avatarContainer}>
                <div className={styles.avatar}>
                  <span className={styles.avatarText}>
                    {profile?.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
              </div>
              <div className={styles.profileInfo}>
                <h1 className={styles.profileName}>
                  {profile?.displayName || 'ゲストユーザー'}
                </h1>
                <p className={styles.profileUsername}>
                  @{profile?.username || 'guest'}
                </p>
                <p className={styles.profileEmail}>
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className={styles.profileContent}>
            {profile ? (
              <div className={styles.statsGrid}>
                {/* Games Played */}
                <div className={`${styles.statCard} ${styles.gamesPlayed}`}>
                  <div className={`${styles.statValue} ${styles.gamesPlayed}`}>
                    {profile.gamesPlayed}
                  </div>
                  <div className={styles.statLabel}>プレイしたゲーム数</div>
                </div>

                {/* Games Won */}
                <div className={`${styles.statCard} ${styles.gamesWon}`}>
                  <div className={`${styles.statValue} ${styles.gamesWon}`}>
                    {profile.gamesWon}
                  </div>
                  <div className={styles.statLabel}>勝利数</div>
                </div>

                {/* Win Rate */}
                <div className={`${styles.statCard} ${styles.winRate}`}>
                  <div className={`${styles.statValue} ${styles.winRate}`}>
                    {winRate}%
                  </div>
                  <div className={styles.statLabel}>勝率</div>
                </div>

                {/* Total Score */}
                <div className={`${styles.statCard} ${styles.totalScore}`}>
                  <div className={`${styles.statValue} ${styles.totalScore}`}>
                    {profile.totalScore}
                  </div>
                  <div className={styles.statLabel}>総スコア</div>
                </div>
              </div>
            ) : (
              <div className={styles.noProfileText}>
                プロフィール情報を読み込んでいます...
              </div>
            )}

            {/* Account Information */}
            <div className={styles.accountSection}>
              <h3 className={styles.sectionTitle}>
                アカウント情報
              </h3>
              <div className={styles.accountInfo}>
                {profile && (
                  <>
                    <div className={styles.accountRow}>
                      <span className={styles.accountLabel}>参加日</span>
                      <span className={styles.accountValue}>
                        {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <div className={styles.accountRow}>
                      <span className={styles.accountLabel}>最終ログイン</span>
                      <span className={styles.accountValue}>
                        {new Date(profile.lastSeenAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </>
                )}
                <div className={styles.accountRow}>
                  <span className={styles.accountLabel}>メールアドレス</span>
                  <span className={styles.accountValue}>{user.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}