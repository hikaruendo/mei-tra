'use client';

import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from './AuthModal';
import { useState, useEffect } from 'react';
import styles from './ProtectedRoute.module.scss';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requireAuth = true,
  fallback
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      setShowAuthModal(true);
    }
  }, [loading, requireAuth, user]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingSpinner}></div>
          <span className={styles.loadingText}>認証状態を確認中...</span>
        </div>
      </div>
    );
  }

  if (requireAuth && !user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className={styles.authRequiredContainer}>
        <div className={styles.authRequiredContent}>
          <div className={styles.authRequiredMessage}>
            <h2 className={styles.authRequiredTitle}>認証が必要です</h2>
            <p className={styles.authRequiredDescription}>
              このページにアクセスするにはログインが必要です
            </p>
          </div>
          <div className={styles.authButtonContainer}>
            <button
              onClick={() => setShowAuthModal(true)}
              className={styles.authButton}
            >
              ログイン
            </button>
          </div>
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}