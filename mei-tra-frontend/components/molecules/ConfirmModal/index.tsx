'use client';

import { useTranslations } from 'next-intl';
import styles from './index.module.scss';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}: ConfirmModalProps) {
  const t = useTranslations('common');

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>{message}</p>
        </div>

        <div className={styles.actions}>
          <button
            onClick={onCancel}
            className={styles.cancelButton}
          >
            {cancelText || t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={styles.confirmButton}
          >
            {confirmText || t('submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
