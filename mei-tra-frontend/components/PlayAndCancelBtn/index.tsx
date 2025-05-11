import React from 'react';
import styles from './index.module.scss';

interface PlayAndCancelBtnProps {
  setSelectedCard: (card: string | null) => void;
  onClick: () => void;
  buttonText: string;
}

export const PlayAndCancelBtn: React.FC<PlayAndCancelBtnProps> = ({
  setSelectedCard,
  onClick,
  buttonText,
}) => {
    return (
      <div className={styles.confirmationButtons}>
        <button 
          className={styles.cancelButton}
          onClick={() => setSelectedCard(null)}
        >
          Cancel
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