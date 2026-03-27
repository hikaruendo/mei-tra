'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/routing';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { UserProfile } from '../profile/UserProfile';
import styles from './Navigation.module.scss';

interface NavigationProps {
  gameStarted?: boolean;
  inRoom?: boolean;
}

export function Navigation({ gameStarted = false, inRoom = false }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [localThemePreference, setLocalThemePreference] = useState<'system' | 'light' | 'dark'>('dark');
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, setThemePreference } = useAuth();
  const currentTheme = user?.profile?.preferences?.theme ?? localThemePreference;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') {
      setLocalThemePreference(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (user?.profile?.preferences?.theme) {
      setLocalThemePreference(user.profile.preferences.theme);
    }
  }, [user?.profile?.preferences?.theme]);

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

  // ホームページでルーム入室中（待機・プレイ問わず）は言語切替を非表示にする
  // ロケール切替によるページリマウントで接続が切断されるのを防ぐため
  const shouldHideLangSwitcher = pathname === '/' && (gameStarted || inRoom);

  const handleThemeChange = (theme: 'system' | 'light' | 'dark') => {
    setLocalThemePreference(theme);
    void setThemePreference(theme);
  };

  const themeOptions = [
    { value: 'system' as const, label: t('themeSystem'), icon: <SystemIcon /> },
    { value: 'light' as const, label: t('themeLight'), icon: <SunIcon /> },
    { value: 'dark' as const, label: t('themeDark'), icon: <MoonIcon /> },
  ];

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
              <Image
                src="/meitra2.webp"
                alt="Meitra"
                width={48}
                height={48}
                className={styles.brandLogo}
                priority
              />
              <span className={styles.brandName}>Meitra</span>
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
              href="/docs"
              className={styles.navLink}
            >
              {t('tutorial')}
            </Link>
            <div className={styles.themeToggle} aria-label={t('themeLabel')}>
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.themeButton} ${currentTheme === option.value ? styles.activeThemeButton : ''}`}
                  onClick={() => handleThemeChange(option.value)}
                  aria-label={option.label}
                  title={option.label}
                >
                  {option.icon}
                </button>
              ))}
            </div>
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
            href="/docs"
            className={styles.mobileNavLink}
            onClick={closeMobileMenu}
          >
            {t('tutorial')}
          </Link>
          <div className={styles.mobileThemeRow}>
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.themeButton} ${currentTheme === option.value ? styles.activeThemeButton : ''}`}
                onClick={() => handleThemeChange(option.value)}
                aria-label={option.label}
                title={option.label}
              >
                {option.icon}
              </button>
            ))}
          </div>
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

function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 11v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.75v1.5M8 12.75v1.5M12.25 8h1.5M2.25 8h1.5M11.9 4.1l1.05-1.05M3.05 12.95 4.1 11.9M11.9 11.9l1.05 1.05M3.05 3.05 4.1 4.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.9 2.1a5.9 5.9 0 1 0 4 9.8A5.7 5.7 0 0 1 9.9 2.1Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
