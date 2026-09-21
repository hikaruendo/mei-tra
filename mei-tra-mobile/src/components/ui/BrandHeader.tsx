import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface BrandHeaderProps {
  subtitle?: string;
}

export function BrandHeader({ subtitle }: BrandHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <Image
          source={require('../../../assets/images/meitra-brand.png')}
          style={styles.mark}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text style={styles.logo}>Meitra</Text>
      </View>
      {subtitle ? (
        <Text numberOfLines={2} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 44, height: 44, borderRadius: 8 },
  logo: {
    color: colors.gold,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
