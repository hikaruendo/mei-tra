'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/layout/Navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import styles from './page.module.scss';

export default function TermsPage() {
  const t = useTranslations('terms');

  return (
    <ProtectedRoute requireAuth={false}>
      <div className={styles.container}>
        <Navigation />
        <main className={styles.main}>
          <header className={styles.header}>
            <h1>{t('title')}</h1>
            <p className={styles.updated}>{t('updated')}</p>
          </header>

          <article className={styles.content}>
            <section className={styles.section}>
              <h2>{t('section1.title')}</h2>
              <p>{t('section1.p1')}</p>
              <p>{t('section1.p2')}</p>
            </section>

            <section className={styles.section}>
              <h2>{t('section2.title')}</h2>
              <p>{t('section2.p1')}</p>
              <p>{t('section2.p2')}</p>
            </section>

            <section className={styles.section}>
              <h2>{t('section3.title')}</h2>
              <ul>
                <li>{t('section3.item1')}</li>
                <li>{t('section3.item2')}</li>
                <li>{t('section3.item3')}</li>
                <li>{t('section3.item4')}</li>
                <li>{t('section3.item5')}</li>
                <li>{t('section3.item6')}</li>
              </ul>
            </section>

            <section className={styles.section}>
              <h2>{t('section4.title')}</h2>
              <p>{t('section4.p1')}</p>
              <p>{t('section4.p2')}</p>
            </section>

            <section className={styles.section}>
              <h2>{t('section5.title')}</h2>
              <p>{t('section5.p1')}</p>
            </section>

            <section className={styles.section}>
              <h2>{t('section6.title')}</h2>
              <p>{t('section6.p1')}</p>
              <p>{t('section6.p2')}</p>
            </section>

            <section className={styles.section}>
              <h2>{t('section7.title')}</h2>
              <p>{t('section7.p1')}</p>
            </section>

            <section className={styles.section}>
              <h2>{t('section8.title')}</h2>
              <p>{t('section8.p1')}</p>
            </section>
          </article>

          <p className={styles.back}>
            <Link href="/">{t('backToTop')}</Link>
          </p>
        </main>
      </div>
    </ProtectedRoute>
  );
}
