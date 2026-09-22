import { useRouter } from 'expo-router';
import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Screen } from '@/components/ui/Screen';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { config } from '@/lib/config';

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
        {createElement('iframe', {
          title: t('settings.rules'),
          src: docsUrl,
          style: styles.iframe,
        })}
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
  iframe: {
    flex: 1,
    width: '100%',
    borderWidth: 0,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
});
