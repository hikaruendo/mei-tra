import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import {
  SettingsCard,
  SettingsScaffold,
} from '@/components/settings/SettingsScaffold';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { colors } from '@/theme/colors';

const sectionKeys = [
  'overview',
  'cards',
  'bid',
  'jack',
  'play',
  'broken',
  'scoring',
  'chombo',
  'strategy',
  'reference',
] as const;

export default function DocsScreen() {
  const router = useRouter();
  useLocale();

  return (
    <SettingsScaffold
      onBack={() => router.replace('/settings/help')}
      title={t('rules.title')}
    >
      <SettingsCard description={t('rules.intro')} title={t('rules.title')} />
      {sectionKeys.map((section) => (
        <SettingsCard key={section} title={t(`rules.${section}Title`)}>
          <Text style={styles.body}>{t(`rules.${section}Body`)}</Text>
        </SettingsCard>
      ))}
    </SettingsScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
});
