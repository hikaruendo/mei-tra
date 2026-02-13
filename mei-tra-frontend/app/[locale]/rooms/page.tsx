'use client';

import { Navigation } from '@/components/layout/Navigation';
import { RoomList } from '@/components/molecules/RoomList';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useSocket } from '@/hooks/useSocket';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export default function RoomsPage() {
  const { isConnected, isConnecting } = useSocket();

  return (
    <ProtectedRoute requireAuth={true}>
      <Navigation />
      <main>
        <RoomList isConnected={isConnected} isConnecting={isConnecting} />
      </main>
    </ProtectedRoute>
  );
}
