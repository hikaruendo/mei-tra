import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { GameProvider } from '@/context/GameContext';
import { LocaleProvider } from '@/context/LocaleContext';
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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <LocaleProvider>
          <AuthProvider>
            <GameProvider>
              <SocialProvider>
                <NotificationProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                    }}
                  />
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
