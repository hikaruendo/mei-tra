'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { Navigation } from './Navigation';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main>{children}</main>
      </div>
    </AuthProvider>
  );
}