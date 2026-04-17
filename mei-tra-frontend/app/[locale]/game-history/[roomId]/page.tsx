import { Navigation } from '@/components/layout/Navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { GameHistoryPageClient } from '@/components/game/GameHistoryPageClient';
import styles from './page.module.scss';

export default async function GameHistoryPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return (
    <ProtectedRoute requireAuth={true}>
      <div className={styles.container}>
        <Navigation />
        <main className={styles.main}>
          <GameHistoryPageClient roomId={roomId} />
        </main>
      </div>
    </ProtectedRoute>
  );
}
