'use client';

import { useTranslations } from 'next-intl';
import { Navigation } from '@/components/layout/Navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TutorialWhitepaper } from '@/components/tutorial/whitepaper/TutorialWhitepaper';

import styles from './page.module.scss';

export const runtime = 'edge';

export default function TutorialPage() {
  const t = useTranslations('tutorial');

  return (
    <ProtectedRoute requireAuth={false}>
      <div className={styles.container}>
        <Navigation />
        <main className={styles.main}>
          <header className={styles.header}>
            <h1>{t('whitepaper')}</h1>
            <p className={styles.description}>
              {t('overview.description')}
            </p>
          </header>

          <TutorialWhitepaper />
        </main>
      </div>
    </ProtectedRoute>
  );
}
