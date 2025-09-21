'use client';

import { Navigation } from '../../components/layout/Navigation';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { TutorialWhitepaper } from '../../components/tutorial/whitepaper/TutorialWhitepaper';

import styles from './page.module.scss';

export default function TutorialPage() {
  return (
    <ProtectedRoute requireAuth={false}>
      <div className={styles.container}>
        <Navigation />
        <main className={styles.main}>
          <header className={styles.header}>
            <h1>Meitra Tutorial</h1>
            <p className={styles.description}>
              Learn the strategic card game through comprehensive documentation.
            </p>
          </header>

          <TutorialWhitepaper />
        </main>
      </div>
    </ProtectedRoute>
  );
}
