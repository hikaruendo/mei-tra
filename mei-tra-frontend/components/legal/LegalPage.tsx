'use client';

import { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/layout/Navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import styles from './LegalPage.module.scss';

interface LegalPageProps {
  title: string;
  updated: string;
  backLabel: string;
  children: ReactNode;
}

export function LegalPage({ title, updated, backLabel, children }: LegalPageProps) {
  return (
    <ProtectedRoute requireAuth={false}>
      <div className={styles.container}>
        <Navigation />
        <main className={styles.main}>
          <header className={styles.header}>
            <h1>{title}</h1>
            <p className={styles.updated}>{updated}</p>
          </header>

          <article className={styles.content}>{children}</article>

          <p className={styles.back}>
            <Link href="/">{backLabel}</Link>
          </p>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
