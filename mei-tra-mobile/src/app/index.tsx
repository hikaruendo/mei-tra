import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme/colors';

export default function IndexScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View accessibilityLabel="ログイン状態を確認しています" style={styles.loading}>
        <ActivityIndicator accessibilityLabel="読み込み中" color={colors.gold} size="large" />
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
