'use client';

import { useTranslations } from 'next-intl';
import { UpgradeAccountForm } from './UpgradeAccountForm';
import styles from './AuthModal.module.scss';

interface UpgradeAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeAccountModal({ isOpen, onClose }: UpgradeAccountModalProps) {
  const t = useTranslations('auth');

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('upgrade.title')}</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <UpgradeAccountForm />
        </div>
      </div>
    </div>
  );
}
