import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LaunchGate } from '@/components/app/LaunchGate';
import { LocaleProvider } from '@/context/LocaleContext';
import { colors } from '@/theme/colors';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.background,
    card: colors.backgroundElevated,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

// Required only once LaunchGate lets the app through: importing the auth module
// creates the Supabase client, which restores and refreshes the session.
function GatedAppProviders({ children }: PropsWithChildren) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppProviders } = require('@/components/app/AppProviders') as typeof import('@/components/app/AppProviders');
  return <AppProviders>{children}</AppProviders>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <LocaleProvider>
          <LaunchGate>
            <GatedAppProviders>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                {/* Keep iOS back swipes from taking over horizontal hand drags. */}
                <Stack.Screen
                  name="room/[roomId]"
                  options={{ gestureEnabled: false }}
                />
              </Stack>
            </GatedAppProviders>
          </LaunchGate>
        </LocaleProvider>
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
