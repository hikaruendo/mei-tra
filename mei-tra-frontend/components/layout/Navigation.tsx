'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter, Link } from '@/i18n/routing';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { FONT_SIZE_PRESETS, FONT_SIZE_PRESET_ORDER } from '@/lib/preferences';
import { FontSizePreset } from '@/types/user.types';
import {
  CheckIcon,
  GlobeIcon,
  MoonIcon,
  SunIcon,
  SystemIcon,
  TextSizeIcon,
} from '@/components/icons/UIIcons';
import { UserProfile } from '@/components/profile/UserProfile';
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
                  <activeThemeOption.Icon size="1.2rem" />
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
                            <option.Icon size="1.2rem" />
                          </span>
                          <span className={styles.utilityOptionLabel}>{option.label}</span>
                        </span>
                        <span className={styles.utilityOptionState} aria-hidden="true">
                          {themePreference === option.value ? <CheckIcon size="1rem" /> : null}
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
                  <TextSizeIcon size="1.2rem" />
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
                          {fontSizePreference === option.value ? <CheckIcon size="1rem" /> : null}
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
                    <GlobeIcon size="1.2rem" />
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
                            {currentLocale === option.value ? <CheckIcon size="1rem" /> : null}
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
                  <option.Icon size="1.2rem" />
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
