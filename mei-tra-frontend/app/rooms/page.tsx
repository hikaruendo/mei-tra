'use client';

import { Navigation } from '../../components/layout/Navigation';
import { RoomList } from '../../components/molecules/RoomList';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';

export const dynamic = 'force-dynamic';

export default function RoomsPage() {
  return (
    <ProtectedRoute requireAuth={false}>
      <Navigation />
      <main>
        <RoomList />
      </main>
    </ProtectedRoute>
  );
}