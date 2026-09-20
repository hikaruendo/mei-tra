import type { CardDesign } from '@meitra/contracts/profile';
import { CARD_DESIGNS } from '@meitra/game-client/card-art';
import { useTranslations } from 'next-intl';
import { CardFace } from '@/components/game/CardFace';
import styles from './CardDesignPicker.module.scss';

export function CardDesignPicker({ value, onChange, disabled }: {
  value: CardDesign;
  onChange: (design: CardDesign) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('profile');
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={styles.legend}>{t('cardDesign')}</legend>
      <p className={styles.hint}>{t('cardDesignHint')}</p>
      <div className={styles.options}>
        {CARD_DESIGNS.map((design) => (
          <label key={design} className={`${styles.option} ${value === design ? styles.selected : ''}`}>
            <span className={styles.heading}>
              <input type="radio" name="cardDesign" value={design} checked={value === design} onChange={() => onChange(design)} />
              {t(`cardDesign_${design}`)}
            </span>
            <span className={styles.preview} aria-hidden="true">
              <span><CardFace faceDown design={design} /></span>
              <span><CardFace card="A♠" design={design} /></span>
              <span><CardFace card="JOKER" design={design} /></span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
