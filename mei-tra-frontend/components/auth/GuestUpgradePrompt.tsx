'use client';

import { useTranslations } from 'next-intl';
import styles from './GuestUpgradePrompt.module.scss';

interface GuestUpgradePromptProps {
  onRegisterClick: () => void;
}

export function GuestUpgradePrompt({ onRegisterClick }: GuestUpgradePromptProps) {
  const t = useTranslations('game');

  return (
    <div className={styles.container}>
      <p className={styles.text}>{t('gameOver.guestPrompt')}</p>
      <button type="button" className={styles.ctaButton} onClick={onRegisterClick}>
        {t('gameOver.guestPromptCta')}
      </button>
    </div>
  );
}
