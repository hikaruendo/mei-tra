'use client';

import { useTranslations } from 'next-intl';
import styles from './RuleCard.module.scss';

interface RuleCardProps {
  rule: {
    title: string;
    description: string;
    example?: string;
  };
}

export function RuleCard({ rule }: RuleCardProps) {
  const t = useTranslations('common');

  return (
    <div className={styles.ruleCard}>
      <h3 className={styles.ruleTitle}>{rule.title}</h3>
      <p className={styles.ruleDescription}>{rule.description}</p>
      {rule.example && (
        <div className={styles.ruleExample}>
          <span className={styles.exampleLabel}>{t('example')}</span>
          <span className={styles.exampleText}>{rule.example}</span>
        </div>
      )}
    </div>
  );
}