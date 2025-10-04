'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/routing';
import { UserProfile } from '../profile/UserProfile';
import styles from './Navigation.module.scss';

interface NavigationProps {
  gameStarted?: boolean;
}

export function Navigation({ gameStarted = false }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const switchLocale = () => {
    const newLocale = locale === 'ja' ? 'en' : 'ja';
    router.replace(pathname, { locale: newLocale });
  };

  // Hide language switcher only when game is started on home page
  const shouldHideLangSwitcher = pathname === '/' && gameStarted;

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
              <svg className={styles.brandLogo} viewBox="0 0 110 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="26" className={styles.brandTextLarge}>M</text>
                <text x="28" y="26" className={styles.brandText}>eitra</text>
              </svg>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className={styles.desktopMenu}>
            <Link
              href="/rooms"
              className={styles.navLink}
            >
              {t('rooms')}
            </Link>
            <Link
              href="/tutorial"
              className={styles.navLink}
            >
              {t('tutorial')}
            </Link>
            {!shouldHideLangSwitcher && (
              <button
                onClick={switchLocale}
                className={styles.langSwitcher}
                aria-label="Switch language"
              >
                {locale === 'ja' ? 'EN' : 'JA'}
              </button>
            )}
            <UserProfile />
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`${styles.mobileMenuButton} ${isMobileMenuOpen ? styles.active : ''}`}
            onClick={toggleMobileMenu}
            aria-label={t('menu')}
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
            {t('rooms')}
          </Link>
          <Link
            href="/tutorial"
            className={styles.mobileNavLink}
            onClick={closeMobileMenu}
          >
            {t('tutorial')}
          </Link>
          {!shouldHideLangSwitcher && (
            <button
              onClick={() => {
                switchLocale();
                closeMobileMenu();
              }}
              className={styles.langSwitcherMobile}
            >
              {locale === 'ja' ? 'English' : '日本語'}
            </button>
          )}
          <div className={styles.mobileUserProfile}>
            <UserProfile />
          </div>
        </div>
      </div>
    </nav>
  );
}