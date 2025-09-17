'use client';

import { ComponentType } from 'react';
import { ProtectedRoute } from './ProtectedRoute';

interface WithAuthOptions {
  requireAuth?: boolean;
  fallback?: React.ReactNode;
}

export function withAuth<P extends object>(
  Component: ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { requireAuth = true, fallback } = options;

  function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute requireAuth={requireAuth} fallback={fallback}>
        <Component {...props} />
      </ProtectedRoute>
    );
  }

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;

  return AuthenticatedComponent;
}