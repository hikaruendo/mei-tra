'use client';

import Link from 'next/link';
import { useState } from 'react';
import { UserProfile } from '../profile/UserProfile';
import styles from './Navigation.module.scss';

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={styles.navigation}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.brand}>
            <Link
              href="/"
              className={styles.brandLink}
              onClick={closeMobileMenu}
            >
              明専トランプ
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className={styles.desktopMenu}>
            <Link
              href="/rooms"
              className={styles.navLink}
            >
              ルーム一覧
            </Link>
            <Link
              href="/tutorial"
              className={styles.navLink}
            >
              チュートリアル
            </Link>
            <UserProfile />
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`${styles.mobileMenuButton} ${isMobileMenuOpen ? styles.active : ''}`}
            onClick={toggleMobileMenu}
            aria-label="メニュー"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Menu */}
      <div className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.open : ''}`}>
        <div className={styles.mobileMenuContent}>
          <Link
            href="/rooms"
            className={styles.mobileNavLink}
            onClick={closeMobileMenu}
          >
            ルーム一覧
          </Link>
          <Link
            href="/tutorial"
            className={styles.mobileNavLink}
            onClick={closeMobileMenu}
          >
            チュートリアル
          </Link>
          <div className={styles.mobileUserProfile}>
            <UserProfile />
          </div>
        </div>
      </div>
    </nav>
  );
}