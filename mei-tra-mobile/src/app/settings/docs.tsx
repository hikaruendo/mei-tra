import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button } from '@/components/ui/Button';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Screen } from '@/components/ui/Screen';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { config } from '@/lib/config';
import { colors } from '@/theme/colors';

export default function DocsScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const docsUrl = `${config.publicWebBaseUrl}/${locale}/docs`;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <BrandHeader subtitle={t('settings.rules')} />
          <Button
            accessibilityLabel={t('settings.back')}
            onPress={() => router.replace('/settings/help')}
            variant="ghost"
          >
            {t('settings.back')}
          </Button>
        </View>
        <WebView
          source={{ uri: docsUrl }}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.gold} />
            </View>
          )}
          style={styles.webView}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  webView: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
});
