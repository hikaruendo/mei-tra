import type { HandSortDirection } from '@meitra/contracts/profile';
import { HAND_SORT_DIRECTIONS } from '@meitra/game-client/hand-order';
import { useTranslations } from 'next-intl';
import styles from './CardDesignPicker.module.scss';

export function HandSortPicker({ value, disabled, onChange }: {
  value: HandSortDirection;
  disabled: boolean;
  onChange: (direction: HandSortDirection) => void;
}) {
  const t = useTranslations('profile');
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={styles.legend}>{t('handSortDirection')}</legend>
      <p className={styles.hint}>{t('handSortDirectionHint')}</p>
      <div className={styles.options}>
        {HAND_SORT_DIRECTIONS.map((direction) => (
          <label key={direction} className={`${styles.option} ${value === direction ? styles.selected : ''}`}>
            <span className={styles.heading}>
              <input type="radio" name="handSortDirection" value={direction} checked={value === direction} onChange={() => onChange(direction)} />
              {t(`handSortDirection_${direction}`)}
            </span>
            <p aria-hidden="true" className={styles.hint}>{direction === 'strong-right' ? '7♠  10♠  K♠  A♠' : 'A♠  K♠  10♠  7♠'}</p>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
