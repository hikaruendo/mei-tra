'use client';

import { Navigation } from '@/components/layout/Navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { TutorialWhitepaper } from '@/components/tutorial/whitepaper/TutorialWhitepaper';

import styles from './page.module.scss';

export default function TutorialPage() {
  return (
    <ProtectedRoute requireAuth={false}>
      <div className={styles.container}>
        <Navigation />
        <main className={styles.main}>
          <TutorialWhitepaper />
        </main>
      </div>
    </ProtectedRoute>
  );
}
