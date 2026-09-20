import type { CardDesign } from '@meitra/contracts/profile';
import { CARD_DESIGNS, normalizeCardDesign } from '@meitra/game-client/card-art';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardArtwork } from '@/components/game/CardArtwork';
import { SettingsCard } from './SettingsScaffold';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';
import { updateProfile } from '@/lib/profile-api';
import { colors } from '@/theme/colors';

export function CardDesignSettings() {
  const { user, getAccessToken, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = normalizeCardDesign(user?.profile?.cardDesign);

  const save = async (cardDesign: CardDesign) => {
    if (!user || saving || cardDesign === selected) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settings.authExpired'));
      await updateProfile(user.id, token, { preferences: { cardDesign } });
      await refreshProfile();
    } catch (error) {
      setError(error instanceof Error ? error.message : t('settings.settingUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard title={t('settings.cardDesign')} description={t('settings.cardDesignHint')}>
      {CARD_DESIGNS.map((design) => (
        <Pressable
          key={design}
          accessibilityRole="radio"
          accessibilityLabel={t(`settings.cardDesign_${design}`)}
          accessibilityState={{ checked: selected === design, disabled: saving }}
          disabled={saving}
          onPress={() => void save(design)}
          style={[styles.option, selected === design && styles.selected]}
        >
          <Text style={styles.label}>{selected === design ? '✓ ' : ''}{t(`settings.cardDesign_${design}`)}</Text>
          <View style={styles.preview} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[undefined, 'A♠', 'JOKER'].map((card) => (
              <View key={card ?? 'back'} style={styles.card}>
                <CardArtwork card={card} faceDown={!card} design={design} />
              </View>
            ))}
          </View>
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
  preview: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  card: { width: 64, height: 96, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.card },
  error: { color: colors.dangerText, fontSize: 14 },
});
