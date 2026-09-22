import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  SettingsCard,
  SettingsScaffold,
} from '@/components/settings/SettingsScaffold';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { colors } from '@/theme/colors';

type DocumentKind = 'privacy' | 'terms';
type Section = {
  key: string;
  paragraphs?: string[];
  items?: string[];
};

const sections: Record<DocumentKind, Section[]> = {
  terms: [
    { key: 'section1', paragraphs: ['p1', 'p2'] },
    { key: 'section2', paragraphs: ['p1', 'p2'] },
    { key: 'section3', items: ['item1', 'item2', 'item3', 'item4', 'item5', 'item6'] },
    { key: 'section4', paragraphs: ['p1', 'p2'] },
    { key: 'section5', paragraphs: ['p1'] },
    { key: 'section6', paragraphs: ['p1', 'p2'] },
    { key: 'section7', paragraphs: ['p1'] },
    { key: 'section8', paragraphs: ['p1'] },
  ],
  privacy: [
    { key: 'section1', paragraphs: ['p1', 'p2'] },
    { key: 'section2', paragraphs: ['p1'], items: ['item1', 'item2', 'item3', 'item4'] },
    { key: 'section3', paragraphs: ['p1', 'p2'] },
    { key: 'section4', paragraphs: ['p1', 'p2'] },
    { key: 'section5', paragraphs: ['p1'] },
    { key: 'section6', paragraphs: ['p1'] },
  ],
};

export function LegalDocumentScreen({ kind }: { kind: DocumentKind }) {
  const router = useRouter();
  useLocale();

  return (
    <SettingsScaffold
      onBack={() => router.replace('/settings/help')}
      title={t(`${kind}.title`)}
    >
      <SettingsCard
        description={t(`${kind}.updated`)}
        title={t(`${kind}.title`)}
      />
      {sections[kind].map((section) => (
        <SettingsCard key={section.key} title={t(`${kind}.${section.key}.title`)}>
          {section.paragraphs?.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {t(`${kind}.${section.key}.${paragraph}`)}
            </Text>
          ))}
          {section.items ? (
            <View style={styles.list}>
              {section.items.map((item) => (
                <Text key={item} style={styles.item}>
                  • {t(`${kind}.${section.key}.${item}`)}
                </Text>
              ))}
            </View>
          ) : null}
        </SettingsCard>
      ))}
    </SettingsScaffold>
  );
}

const styles = StyleSheet.create({
  paragraph: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
  list: {
    gap: 8,
  },
  item: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
});
