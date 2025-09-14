export { useAuth } from '@/contexts/AuthContext';

// Additional auth-related hooks

import { useAuth as useAuthContext } from '@/contexts/AuthContext';

export function useRequireAuth() {
  const auth = useAuthContext();

  if (!auth.user && !auth.loading) {
    throw new Error('Authentication required');
  }

  return auth;
}

export function useOptionalAuth() {
  const auth = useAuthContext();
  return auth;
}