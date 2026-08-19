import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';
import { useLocale } from '@/context/LocaleContext';

export default function IndexScreen() {
  // Re-render this screen when the app language changes; t() is a bare
  // function and cannot trigger that on its own.
  useLocale();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View accessibilityLabel={t('auth.checkingSession')} style={styles.loading}>
        <ActivityIndicator accessibilityLabel={t('auth.loading')} color={colors.gold} size="large" />
      </View>
    );
  }

  return <Redirect href={user ? '/rooms' : '/sign-in'} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
