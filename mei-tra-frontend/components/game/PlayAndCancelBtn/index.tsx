import React from 'react';
import { useTranslations } from 'next-intl';
import styles from './index.module.scss';

interface PlayAndCancelBtnProps {
  setSelectedCard: (card: string | null) => void;
  onCancel: () => void;
  onClick: () => void;
  buttonText: string;
}

export const PlayAndCancelBtn: React.FC<PlayAndCancelBtnProps> = ({
  setSelectedCard,
  onCancel,
  onClick,
  buttonText,
}) => {
  const t = useTranslations('common');

  return (
      <div className={styles.confirmationButtons}>
        <button
          className={styles.cancelButton}
          onClick={() => {
            onCancel();
            setSelectedCard(null);
          }}
        >
          {t('cancel')}
        </button>
        <button 
          className={styles.confirmButton}
          onClick={onClick}
        >
          {buttonText}
        </button>
      </div>
    );
};
