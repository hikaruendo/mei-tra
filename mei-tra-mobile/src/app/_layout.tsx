import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { GameProvider } from '@/context/GameContext';
import { LocaleProvider, useLocale } from '@/context/LocaleContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { SocialProvider } from '@/context/SocialContext';
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

/**
 * `t()` is a bare function, so switching languages does not re-render screens
 * on its own. Keying the navigator on the locale rebuilds the screen tree,
 * while the providers above it — and with them the socket and game state —
 * stay mounted.
 */
function LocalisedStack() {
  const { locale } = useLocale();

  return (
    <Stack
      key={locale}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <LocaleProvider>
          <AuthProvider>
            <GameProvider>
              <SocialProvider>
                <NotificationProvider>
                  <LocalisedStack />
                </NotificationProvider>
              </SocialProvider>
            </GameProvider>
          </AuthProvider>
        </LocaleProvider>
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
