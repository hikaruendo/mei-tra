'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/routing';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { FONT_SIZE_PRESETS, FONT_SIZE_PRESET_ORDER } from '@/lib/preferences';
import { FontSizePreset } from '@/types/user.types';
import { UserProfile } from '../profile/UserProfile';
import styles from './Navigation.module.scss';

interface NavigationProps {
  gameStarted?: boolean;
  inRoom?: boolean;
}

type UtilityMenu = 'theme' | 'fontSize' | 'language';

type ThemeOption = {
  value: 'system' | 'light' | 'dark';
  label: string;
  Icon: typeof SystemIcon;
};

const HEADER_ICON_SIZE = '1.2rem';
const HEADER_CHECK_ICON_SIZE = '1rem';

export function Navigation({ gameStarted = false, inRoom = false }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openUtilityMenu, setOpenUtilityMenu] = useState<UtilityMenu | null>(null);
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const {
    fontSizePreference,
    setFontSizePreference,
    setThemePreference,
    themePreference,
  } = useAuth();

  const currentLocale = locale === 'en' ? 'en' : 'ja';

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const closeUtilityMenu = () => {
    setOpenUtilityMenu(null);
  };

  const toggleUtilityMenu = (menu: UtilityMenu) => {
    setOpenUtilityMenu((prev) => (prev === menu ? null : menu));
  };

  const changeLocale = (nextLocale: 'ja' | 'en') => {
    if (nextLocale === currentLocale) {
      closeUtilityMenu();
      return;
    }

    closeUtilityMenu();
    router.replace(pathname, { locale: nextLocale });
  };

  const switchLocale = () => {
    changeLocale(currentLocale === 'ja' ? 'en' : 'ja');
  };

  // ホームページでルーム入室中（待機・プレイ問わず）は言語切替を非表示にする
  // ロケール切替によるページリマウントで接続が切断されるのを防ぐため
  const shouldHideLangSwitcher = pathname === '/' && (gameStarted || inRoom);

  const handleThemeChange = (theme: 'system' | 'light' | 'dark') => {
    closeUtilityMenu();
    void setThemePreference(theme);
  };

  const handleFontSizeChange = (fontSize: FontSizePreset) => {
    closeUtilityMenu();
    void setFontSizePreference(fontSize);
  };

  useEffect(() => {
    closeUtilityMenu();
  }, [pathname]);

  useEffect(() => {
    if (!openUtilityMenu) {
      return;
    }

    const activeMenuRef =
      openUtilityMenu === 'theme'
        ? themeMenuRef
        : openUtilityMenu === 'fontSize'
          ? fontSizeMenuRef
          : languageMenuRef;

    const handlePointerDown = (event: MouseEvent) => {
      if (!activeMenuRef.current?.contains(event.target as Node)) {
        closeUtilityMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeUtilityMenu();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openUtilityMenu]);

  const themeOptions: ThemeOption[] = [
    { value: 'system', label: t('themeSystem'), Icon: SystemIcon },
    { value: 'light', label: t('themeLight'), Icon: SunIcon },
    { value: 'dark', label: t('themeDark'), Icon: MoonIcon },
  ];

  const fontSizeLabelKeys: Record<
    FontSizePreset,
    'fontSizeStandard' | 'fontSizeLarge' | 'fontSizeXLarge' | 'fontSizeXXLarge'
  > = {
    standard: 'fontSizeStandard',
    large: 'fontSizeLarge',
    xlarge: 'fontSizeXLarge',
    xxlarge: 'fontSizeXXLarge',
  };

  const fontSizeOptions = FONT_SIZE_PRESET_ORDER.map((value) => ({
    value,
    label: t(fontSizeLabelKeys[value]),
    scale: `${FONT_SIZE_PRESETS[value].rootPercent}%`,
  }));

  const languageOptions = [
    { value: 'ja' as const, label: t('languageJapanese') },
    { value: 'en' as const, label: t('languageEnglish') },
  ];

  const activeThemeOption = themeOptions.find((option) => option.value === themePreference) ?? themeOptions[0];
  const activeFontSizeLabel = t(fontSizeLabelKeys[fontSizePreference]);
  const activeLanguageLabel = languageOptions.find((option) => option.value === currentLocale)?.label ?? currentLocale;

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

          <div className={styles.desktopMenu}>
            <div className={styles.primaryNav}>
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
            </div>

            <div className={styles.utilityRail}>
              <div className={styles.utilityMenu} ref={themeMenuRef}>
                <button
                  type="button"
                  className={`${styles.utilityTrigger} ${openUtilityMenu === 'theme' ? styles.utilityTriggerOpen : ''}`}
                  onClick={() => toggleUtilityMenu('theme')}
                  aria-expanded={openUtilityMenu === 'theme'}
                  aria-haspopup="menu"
                  aria-label={`${t('themeLabel')}: ${activeThemeOption.label}`}
                  title={`${t('themeLabel')}: ${activeThemeOption.label}`}
                >
                  <activeThemeOption.Icon />
                  <span className={styles.srOnly}>{t('themeLabel')}</span>
                </button>
                {openUtilityMenu === 'theme' && (
                  <div className={styles.utilityPopover} role="menu" aria-label={t('themeLabel')}>
                    <span className={styles.utilityPopoverTitle}>{t('themeLabel')}</span>
                    {themeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={themePreference === option.value}
                        className={`${styles.utilityOption} ${themePreference === option.value ? styles.activeUtilityOption : ''}`}
                        onClick={() => handleThemeChange(option.value)}
                      >
                        <span className={styles.utilityOptionLead}>
                          <span className={styles.utilityOptionIcon} aria-hidden="true">
                            <option.Icon />
                          </span>
                          <span className={styles.utilityOptionLabel}>{option.label}</span>
                        </span>
                        <span className={styles.utilityOptionState} aria-hidden="true">
                          {themePreference === option.value ? <CheckIcon /> : null}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.utilityMenu} ref={fontSizeMenuRef}>
                <button
                  type="button"
                  className={`${styles.utilityTrigger} ${openUtilityMenu === 'fontSize' ? styles.utilityTriggerOpen : ''}`}
                  onClick={() => toggleUtilityMenu('fontSize')}
                  aria-expanded={openUtilityMenu === 'fontSize'}
                  aria-haspopup="menu"
                  aria-label={`${t('fontSizeLabel')}: ${activeFontSizeLabel}`}
                  title={`${t('fontSizeLabel')}: ${activeFontSizeLabel}`}
                >
                  <TextSizeIcon />
                  <span className={styles.srOnly}>{t('fontSizeLabel')}</span>
                </button>
                {openUtilityMenu === 'fontSize' && (
                  <div className={`${styles.utilityPopover} ${styles.utilityPopoverWide}`} role="menu" aria-label={t('fontSizeLabel')}>
                    <span className={styles.utilityPopoverTitle}>{t('fontSizeLabel')}</span>
                    {fontSizeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={fontSizePreference === option.value}
                        className={`${styles.utilityOption} ${fontSizePreference === option.value ? styles.activeUtilityOption : ''}`}
                        onClick={() => handleFontSizeChange(option.value)}
                      >
                        <span className={styles.utilityOptionText}>
                          <span className={styles.utilityOptionLabel}>{option.label}</span>
                          <span className={styles.utilityOptionMeta}>{option.scale}</span>
                        </span>
                        <span className={styles.utilityOptionPreview} aria-hidden="true">
                          <span
                            className={styles.utilityOptionPreviewGlyph}
                            style={{ fontSize: `${FONT_SIZE_PRESETS[option.value].scale}rem` }}
                          >
                            A
                          </span>
                          {fontSizePreference === option.value ? <CheckIcon /> : null}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!shouldHideLangSwitcher && (
                <div className={styles.utilityMenu} ref={languageMenuRef}>
                  <button
                    type="button"
                    className={`${styles.utilityTrigger} ${openUtilityMenu === 'language' ? styles.utilityTriggerOpen : ''}`}
                    onClick={() => toggleUtilityMenu('language')}
                    aria-expanded={openUtilityMenu === 'language'}
                    aria-haspopup="menu"
                    aria-label={`${t('languageLabel')}: ${activeLanguageLabel}`}
                    title={`${t('languageLabel')}: ${activeLanguageLabel}`}
                  >
                    <GlobeIcon />
                    <span className={styles.srOnly}>{t('languageLabel')}</span>
                  </button>
                  {openUtilityMenu === 'language' && (
                    <div className={`${styles.utilityPopover} ${styles.utilityPopoverCompact}`} role="menu" aria-label={t('languageLabel')}>
                      <span className={styles.utilityPopoverTitle}>{t('languageLabel')}</span>
                      {languageOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={currentLocale === option.value}
                          className={`${styles.utilityOption} ${currentLocale === option.value ? styles.activeUtilityOption : ''}`}
                          onClick={() => changeLocale(option.value)}
                        >
                          <span className={styles.utilityOptionLabel}>{option.label}</span>
                          <span className={styles.utilityOptionState} aria-hidden="true">
                            {currentLocale === option.value ? <CheckIcon /> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <UserProfile variant="compact" />
            </div>
          </div>

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

      {isMobileMenuOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={closeMobileMenu}
        />
      )}

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
          <div className={styles.mobileSettingsSection}>
            <span className={styles.mobileSectionLabel}>{t('themeLabel')}</span>
            <div className={styles.mobileThemeRow}>
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.themeButton} ${themePreference === option.value ? styles.activeThemeButton : ''}`}
                  onClick={() => handleThemeChange(option.value)}
                  aria-label={option.label}
                  title={option.label}
                >
                  <option.Icon />
                </button>
              ))}
            </div>
          </div>
          <div className={styles.mobileSettingsSection}>
            <span className={styles.mobileSectionLabel}>{t('fontSizeLabel')}</span>
            <div className={styles.mobileFontSizeList}>
              {fontSizeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.mobileFontSizeButton} ${fontSizePreference === option.value ? styles.activeMobileFontSizeButton : ''}`}
                  onClick={() => handleFontSizeChange(option.value)}
                >
                  <span>{option.label}</span>
                  <span className={styles.mobileFontSizeScale}>{option.scale}</span>
                </button>
              ))}
            </div>
          </div>
          {!shouldHideLangSwitcher && (
            <button
              onClick={() => {
                switchLocale();
                closeMobileMenu();
              }}
              className={styles.langSwitcherMobile}
            >
              {currentLocale === 'ja' ? 'English' : '日本語'}
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
    <svg width={HEADER_ICON_SIZE} height={HEADER_ICON_SIZE} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 11v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width={HEADER_ICON_SIZE} height={HEADER_ICON_SIZE} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.75v1.5M8 12.75v1.5M12.25 8h1.5M2.25 8h1.5M11.9 4.1l1.05-1.05M3.05 12.95 4.1 11.9M11.9 11.9l1.05 1.05M3.05 3.05 4.1 4.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width={HEADER_ICON_SIZE} height={HEADER_ICON_SIZE} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.9 2.1a5.9 5.9 0 1 0 4 9.8A5.7 5.7 0 0 1 9.9 2.1Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TextSizeIcon() {
  return (
    <svg width={HEADER_ICON_SIZE} height={HEADER_ICON_SIZE} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 12.5 5.8 3.5h1.4L10 12.5M4.1 9h4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.4 12.5V8.2M9.7 9.9h3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width={HEADER_ICON_SIZE} height={HEADER_ICON_SIZE} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 8h10.4M8 2.25c1.6 1.4 2.5 3.53 2.5 5.75S9.6 12.35 8 13.75M8 2.25C6.4 3.65 5.5 5.78 5.5 8s.9 4.35 2.5 5.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={HEADER_CHECK_ICON_SIZE} height={HEADER_CHECK_ICON_SIZE} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3.5 8.4 2.5 2.5 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
