'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '../auth/AuthModal';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UserIcon } from '@/components/icons/UIIcons';
import styles from './UserProfile.module.scss';

interface UserProfileProps {
  variant?: 'default' | 'compact';
}

export function UserProfile({ variant = 'default' }: UserProfileProps) {
  const { user, signOut, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isCompactMenuOpen, setIsCompactMenuOpen] = useState(false);
  const compactMenuRef = useRef<HTMLDivElement | null>(null);
  const t = useTranslations('profile');
  const isCompact = variant === 'compact';

  const displayName = user?.profile?.displayName || user?.email || t('guestUser');
  const username = user?.profile?.username || user?.id.slice(0, 8) || 'guest';
  const secondaryEmail = user?.email && user.profile?.displayName && user.profile.displayName !== user.email
    ? user.email
    : null;

  useEffect(() => {
    if (!isCompact || !isCompactMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!compactMenuRef.current?.contains(event.target as Node)) {
        setIsCompactMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCompactMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCompact, isCompactMenuOpen]);

  const closeCompactMenu = () => {
    setIsCompactMenuOpen(false);
  };

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

  const renderAvatar = (className: string, placeholderClassName: string) => {
    if (user?.profile?.avatarUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.profile.avatarUrl}
          alt={t('profileImage')}
          className={className}
        />
      );
    }

    return (
      <div className={placeholderClassName}>
        {displayName.charAt(0).toUpperCase() || '?'}
      </div>
    );
  };

  if (loading) {
    if (isCompact) {
      return (
        <div className={styles.compactStatus} aria-label={t('loading')} title={t('loading')}>
          <div className={styles.loadingSpinner}></div>
        </div>
      );
    }

    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <span className={styles.loadingText}>{t('loading')}</span>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {isCompact ? (
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className={styles.compactTrigger}
            aria-label={t('loginButton')}
            title={t('loginButton')}
          >
            <UserIcon size="1.2rem" />
            <span className={styles.srOnly}>{t('loginButton')}</span>
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className={styles.loginButton}
          >
            {t('loginButton')}
          </button>
        )}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  if (isCompact) {
    return (
      <div className={styles.compactMenu} ref={compactMenuRef}>
        <button
          type="button"
          className={`${styles.compactTrigger} ${isCompactMenuOpen ? styles.compactTriggerOpen : ''}`}
          onClick={() => setIsCompactMenuOpen((prev) => !prev)}
          aria-expanded={isCompactMenuOpen}
          aria-haspopup="menu"
          aria-label={`${t('title')}: ${displayName}`}
          title={displayName}
        >
          {renderAvatar(styles.avatar, styles.avatarPlaceholder)}
          <span className={styles.srOnly}>{t('title')}</span>
        </button>

        {isCompactMenuOpen && (
          <div className={styles.compactPopover} role="menu" aria-label={t('accountInfo')}>
            <Link href="/profile" className={styles.compactSummary} onClick={closeCompactMenu} role="menuitem">
              <span className={styles.compactDisplayName}>{displayName}</span>
              {secondaryEmail ? (
                <span className={styles.compactMeta}>{secondaryEmail}</span>
              ) : null}
              <span className={styles.compactMeta}>@{username}</span>
            </Link>
            <div className={styles.compactActions}>
              <Link href="/profile" className={styles.compactActionLink} onClick={closeCompactMenu} role="menuitem">
                {t('title')}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeCompactMenu();
                  void handleSignOut();
                }}
                disabled={isSigningOut}
                className={styles.compactActionButton}
              >
                {isSigningOut ? t('loggingOut') : t('logout')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.userContainer}>
      <div className={styles.avatarContainer}>
        {renderAvatar(styles.avatar, styles.avatarPlaceholder)}
      </div>

      <Link href="/profile" className={styles.profileLink}>
        <div className={styles.userInfo}>
          <span className={styles.displayName}>{displayName}</span>
          <span className={styles.username}>@{username}</span>
        </div>
      </Link>

      <button
        onClick={() => {
          void handleSignOut();
        }}
        disabled={isSigningOut}
        className={styles.signOutButton}
      >
        {isSigningOut ? t('loggingOut') : t('logout')}
      </button>
    </div>
  );
}
