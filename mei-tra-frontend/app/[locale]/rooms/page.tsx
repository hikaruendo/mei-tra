'use client';

import { Navigation } from '@/components/layout/Navigation';
import { RoomList } from '@/components/room/RoomList';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useSocket } from '@/hooks/useSocket';
import { useRouter } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default function RoomsPage() {
  const { isConnected, isConnecting } = useSocket();
  const router = useRouter();

  return (
    <ProtectedRoute requireAuth={true}>
      <Navigation />
      <main>
        <RoomList
          isConnected={isConnected}
          isConnecting={isConnecting}
          onRoomEntered={() => router.push('/')}
        />
      </main>
    </ProtectedRoute>
  );
}
