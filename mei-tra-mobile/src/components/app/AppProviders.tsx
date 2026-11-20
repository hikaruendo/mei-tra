import type { PropsWithChildren } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { GameProvider } from '@/context/GameContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { SocialProvider } from '@/context/SocialContext';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <GameProvider>
        <SocialProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </SocialProvider>
      </GameProvider>
    </AuthProvider>
  );
}
