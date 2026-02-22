'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TrumpType } from '../../types/game.types';
import {
  getStrengthOrder,
  getTrumpDisplay,
} from '../../lib/utils/trumpDisplay';
import styles from './StrengthOrderDock.module.scss';

const SUIT_KEYS: Record<TrumpType, string> = {
  herz: 'suitHerz',
  daiya: 'suitDaiya',
  club: 'suitClub',
  zuppe: 'suitZuppe',
  tra: 'suitTra',
};

interface StrengthOrderDockProps {
  currentTrump: TrumpType | null;
}

export function StrengthOrderDock({ currentTrump }: StrengthOrderDockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tJack = useTranslations('tutorial.jack');
  const tGame = useTranslations('game');
  const tCommon = useTranslations('common');

  const strengthOrder = getStrengthOrder(currentTrump);
  const trumpSymbol = getTrumpDisplay(currentTrump);

  const sectionTitle =
    currentTrump && currentTrump !== 'tra'
      ? tGame('trumpFormat', {
          suit: tGame(SUIT_KEYS[currentTrump]),
          symbol: trumpSymbol,
        })
      : null;

  return (
    <div className={styles.dock}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={styles.orderButton}
        aria-expanded={isOpen}
      >
        {tGame('orderButton')}
      </button>
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{tGame('orderButton')}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={styles.closeButton}
              aria-label={tCommon('close')}
            >
              ×
            </button>
          </div>
          <div className={styles.content}>
            {sectionTitle && (
              <div className={styles.sectionTitle}>{sectionTitle}</div>
            )}
            <div className={styles.section}>
              <div className={styles.strengthLabel}>{tJack('strengthOrder')}</div>
              <div className={styles.strengthRow}>
                {strengthOrder.map((item, i) => {
                  let label: string;
                  if (item.type === 'otherCards') {
                    label = tJack('otherCards');
                  } else if (item.type === 'otherTrump' && item.suitKey && item.label) {
                    label = `${item.label}（${tJack('other')}${tJack(item.suitKey)}）`;
                  } else if (item.type === 'generic' && item.label) {
                    label = item.label;
                  } else {
                    label = item.label ?? '';
                  }
                  return (
                    <span key={`${item.type}-${i}`} className={styles.strengthItem}>
                      {i > 0 && ' > '}
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
            {currentTrump === 'tra' && (
              <div className={styles.traNote}>
                <div className={styles.traNoteTitle}>{tJack('traException')}</div>
                <div className={styles.traNoteDesc}>{tJack('traExceptionDesc')}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
