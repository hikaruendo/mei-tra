'use client';

import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { RoomList } from '@/components/room/RoomList';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useRouter } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default function RoomsPage() {
  const router = useRouter();

  return (
    <ProtectedRoute requireAuth={true}>
      <Navigation />
      <main>
        <RoomList
          onRoomEntered={() => router.push('/')}
        />
        <Footer />
      </main>
    </ProtectedRoute>
  );
}
