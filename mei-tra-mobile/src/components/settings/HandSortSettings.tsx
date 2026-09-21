import type { HandSortDirection } from '@meitra/contracts/profile';
import { HAND_SORT_DIRECTIONS, normalizeHandSortDirection } from '@meitra/game-client/hand-order';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SettingsCard } from './SettingsScaffold';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { updateProfile } from '@/lib/profile-api';
import { colors } from '@/theme/colors';

export function HandSortSettings() {
  const { user, getAccessToken, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = normalizeHandSortDirection(user?.profile?.handSortDirection);

  const save = async (handSortDirection: HandSortDirection) => {
    if (!user || saving || handSortDirection === selected) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settings.authExpired'));
      await updateProfile(user.id, token, { preferences: { handSortDirection } });
      await refreshProfile();
    } catch (error) {
      setError(error instanceof Error ? error.message : t('settings.settingUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title={t('settings.handSortDirection')} description={t('settings.handSortDirectionHint')}>
      {HAND_SORT_DIRECTIONS.map((direction) => (
        <Pressable
          key={direction}
          accessibilityRole="radio"
          accessibilityLabel={t(`settings.handSortDirection_${direction}`)}
          accessibilityState={{ checked: selected === direction, disabled: saving }}
          disabled={saving}
          onPress={() => void save(direction)}
          style={[styles.option, selected === direction && styles.selected]}
        >
          <Text style={styles.label}>{selected === direction ? '✓ ' : ''}{t(`settings.handSortDirection_${direction}`)}</Text>
          <Text style={styles.preview} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {direction === 'strong-right' ? '7♠  10♠  K♠  A♠' : 'A♠  K♠  10♠  7♠'}
          </Text>
        </Pressable>
      ))}
      {saving ? <Text style={styles.label}>{t('settings.saving')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </SettingsCard>
  );
}

const styles = StyleSheet.create({
  option: { padding: 14, borderRadius: 12, borderWidth: 2, borderColor: colors.border, gap: 12 },
  selected: { borderColor: colors.gold },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  preview: { color: colors.textMuted, fontSize: 18, textAlign: 'center' },
  error: { color: colors.dangerText, fontSize: 14 },
});
