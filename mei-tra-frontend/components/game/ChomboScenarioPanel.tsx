import { useTranslations } from 'next-intl';
import type { DevChomboScenarioType } from '@contracts/game';
import styles from './ChomboScenarioPanel.module.scss';

interface ChomboScenarioPanelProps {
  onSelect: (violationType: DevChomboScenarioType) => void;
}

export function ChomboScenarioPanel({ onSelect }: ChomboScenarioPanelProps) {
  const t = useTranslations('chomboScenario');
  const scenarios: { type: DevChomboScenarioType; label: string; hint: string }[] = [
    { type: 'negri-forget', label: t('negriForget'), hint: t('negriForgetHint') },
    { type: 'wrong-suit', label: t('wrongSuit'), hint: t('wrongSuitHint') },
    { type: 'four-jack', label: t('fourJack'), hint: t('fourJackHint') },
    { type: 'last-tanzen', label: t('lastTanzen'), hint: t('lastTanzenHint') },
    { type: 'failed-open', label: t('failedOpen'), hint: t('failedOpenHint') },
  ];

  return (
    <section className={styles.panel} aria-label={t('title')}>
      <p className={styles.title}>{t('title')}</p>
      <p className={styles.description}>{t('description')}</p>
      {scenarios.map(({ type, label, hint }) => (
        <button
          key={type}
          type="button"
          className={styles.scenario}
          onClick={() => onSelect(type)}
        >
          <span className={styles.label}>{label}</span>
          <span className={styles.hint}>{hint}</span>
        </button>
      ))}
    </section>
  );
}
