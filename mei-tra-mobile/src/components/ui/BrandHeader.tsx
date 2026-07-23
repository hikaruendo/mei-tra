import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface BrandHeaderProps {
  subtitle?: string;
}

export function BrandHeader({ subtitle }: BrandHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Meitra</Text>
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
