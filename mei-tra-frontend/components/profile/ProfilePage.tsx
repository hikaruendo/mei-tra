'use client';

import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '../auth/AuthModal';
import { ProfileEditForm } from './ProfileEditForm';
import { Navigation } from '../layout/Navigation';
import { useState } from 'react';
import { UserProfile } from '@/types/user.types';
import { useTranslations } from 'next-intl';
import styles from './ProfilePage.module.scss';

export function ProfilePage() {
  const { user, loading } = useAuth();
  const t = useTranslations('profile');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(user?.profile || null);

  if (loading) {
    return (
      <>
        <Navigation />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingContent}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>{t('loading')}</span>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navigation />
        <div className={styles.noAuthContainer}>
          <div className={styles.noAuthContent}>
            <div>
              <h2 className={styles.noAuthTitle}>{t('title')}</h2>
            <p className={styles.noAuthDescription}>
              {t('loginRequired')}
            </p>
          </div>
          <div className={styles.noAuthButtonContainer}>
            <button
              onClick={() => setShowAuthModal(true)}
              className={styles.loginButton}
            >
              {t('loginButton')}
            </button>
          </div>
            <AuthModal
              isOpen={showAuthModal}
              onClose={() => setShowAuthModal(false)}
            />
          </div>
        </div>
      </>
    );
  }

  const profile = currentProfile || user.profile;
  const winRate = profile?.gamesPlayed ? (profile.gamesWon / profile.gamesPlayed * 100).toFixed(1) : '0.0';

  const handleEditSave = (updatedProfile: UserProfile) => {
    setCurrentProfile(updatedProfile);
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
  };

  if (isEditing && profile) {
    return (
      <>
        <Navigation />
        <div className={styles.container}>
          <div className={styles.mainContainer}>
          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <h1 className={styles.editTitle}>{t('edit')}</h1>
            </div>
            <ProfileEditForm
              profile={profile}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className={styles.container}>
      <div className={styles.mainContainer}>
        <div className={styles.profileCard}>
          {/* Profile Header */}
          <div className={styles.profileHeader}>
            <div className={styles.profileHeaderContent}>
              <div className={styles.avatarContainer}>
                {profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={t('profileImage')}
                    className={styles.avatarImage}
                  />
                ) : (
                  <div className={styles.avatar}>
                    <span className={styles.avatarText}>
                      {profile?.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.profileInfo}>
                <h1 className={styles.profileName}>
                  {profile?.displayName || user?.email || 'User'}
                </h1>
                <p className={styles.profileUsername}>
                  @{profile?.username || user?.id.substring(0, 8) || 'unknown'}
                </p>
                <p className={styles.profileEmail}>
                  {user.email}
                </p>
              </div>
              <div className={styles.headerActions}>
                <button
                  onClick={() => setIsEditing(true)}
                  className={styles.editButton}
                >
                  {t('editButton')}
                </button>
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
                  <div className={styles.statLabel}>{t('gamesPlayed')}</div>
                </div>

                {/* Games Won */}
                <div className={`${styles.statCard} ${styles.gamesWon}`}>
                  <div className={`${styles.statValue} ${styles.gamesWon}`}>
                    {profile.gamesWon}
                  </div>
                  <div className={styles.statLabel}>{t('wins')}</div>
                </div>

                {/* Win Rate */}
                <div className={`${styles.statCard} ${styles.winRate}`}>
                  <div className={`${styles.statValue} ${styles.winRate}`}>
                    {winRate}%
                  </div>
                  <div className={styles.statLabel}>{t('winRate')}</div>
                </div>

                {/* Total Score */}
                <div className={`${styles.statCard} ${styles.totalScore}`}>
                  <div className={`${styles.statValue} ${styles.totalScore}`}>
                    {profile.totalScore}
                  </div>
                  <div className={styles.statLabel}>{t('totalScore')}</div>
                </div>
              </div>
            ) : (
              <div className={styles.noProfileText}>
                {t('loadingProfile')}
              </div>
            )}

            {/* Account Information */}
            <div className={styles.accountSection}>
              <h3 className={styles.sectionTitle}>
                {t('accountInfo')}
              </h3>
              <div className={styles.accountInfo}>
                {profile && (
                  <>
                    <div className={styles.accountRow}>
                      <span className={styles.accountLabel}>{t('joinDate')}</span>
                      <span className={styles.accountValue}>
                        {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <div className={styles.accountRow}>
                      <span className={styles.accountLabel}>{t('lastLogin')}</span>
                      <span className={styles.accountValue}>
                        {new Date(profile.lastSeenAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </>
                )}
                <div className={styles.accountRow}>
                  <span className={styles.accountLabel}>{t('emailAddress')}</span>
                  <span className={styles.accountValue}>{user.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}