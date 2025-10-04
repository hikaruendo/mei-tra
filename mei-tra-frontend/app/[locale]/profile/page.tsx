'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfilePage } from '@/components/profile/ProfilePage';

export const dynamic = 'force-dynamic';

export default function Profile() {
  return (
    <ProtectedRoute requireAuth={true}>
      <ProfilePage />
    </ProtectedRoute>
  );
}