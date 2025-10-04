'use client';

import { useTranslations } from 'next-intl';
import styles from './JackSystem.module.scss';

interface JackSystemProps {
  data: {
    title: string;
  };
}

export function JackSystem({ data }: JackSystemProps) {
  const t = useTranslations('tutorial.jack');

  const trumpTypes = [
    { type: 'herz', labelFull: t('herzTrump'), suitName: t('herz'), suit: '♥', subSuit: '♦' },
    { type: 'daiya', labelFull: t('daiyaTrump'), suitName: t('daiya'), suit: '♦', subSuit: '♥' },
    { type: 'club', labelFull: t('clubTrump'), suitName: t('club'), suit: '♣', subSuit: '♠' },
    { type: 'zuppe', labelFull: t('zuppeTrump'), suitName: t('zuppe'), suit: '♠', subSuit: '♣' },
  ];

  return (
    <div className={styles.jackSystem}>
      <h3 className={styles.title}>{data.title}</h3>

      <div className={styles.explanation}>
        <p>{t('rulesIntro')}</p>
        <ul>
          <li><strong>{t('jokerRule')}</strong>：{t('jokerDesc')}</li>
          <li><strong>{t('mainJackRule')}</strong>：{t('mainJackDesc')}</li>
          <li><strong>{t('subJackRule')}</strong>：{t('subJackDesc')}</li>
        </ul>
      </div>

      <div className={styles.trumpExamples}>
        {trumpTypes.map((trump) => (
          <div key={trump.type} className={styles.trumpExample}>
            <div className={styles.trumpHeader}>
              <span className={styles.trumpIcon}>{trump.suit}</span>
              <span className={styles.trumpLabel}>{trump.labelFull}</span>
            </div>

            <div className={styles.strengthOrder}>
              <span>{t('strengthOrder')}</span>
              <span className={styles.orderText}>
                JOKER &gt; J{trump.suit} &gt; J{trump.subSuit} &gt; {t('other')}{trump.suitName} &gt; {t('otherCards')}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.traException}>
        <div className={styles.exceptionHeader}>
          <span className={styles.exceptionIcon}>⚠️</span>
          <span className={styles.exceptionTitle}>{t('traException')}</span>
        </div>
        <p>
          {t('traExceptionDesc')}
        </p>
      </div>
    </div>
  );
}