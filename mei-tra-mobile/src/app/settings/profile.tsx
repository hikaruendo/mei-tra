import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  SettingsCard,
  SettingsScaffold,
} from '@/components/settings/SettingsScaffold';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { t } from '@/i18n';
import { updateProfile, uploadAvatar } from '@/lib/profile-api';
import { colors } from '@/theme/colors';

export default function ProfileSettingsScreen() {
  useLocale();
  const router = useRouter();
  const { user, loading, getAccessToken, refreshProfile } = useAuth();
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const displayName =
    user?.profile?.displayName ||
    user?.profile?.username ||
    user?.email?.split('@')[0] ||
    'Player';

  useEffect(() => {
    if (!savingName) setNameInput(displayName);
  }, [displayName, savingName]);

  if (!loading && !user) {
    return <Redirect href="/sign-in" />;
  }

  if (loading || !user) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.loading}>{t('rooms.loadingAccount')}</Text>
      </Screen>
    );
  }

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === displayName) return;

    setSavingName(true);
    setProfileError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settings.authExpired'));
      await updateProfile(user.id, token, { displayName: trimmed });
      await refreshProfile();
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : t('settings.displayNameUpdateFailed'),
      );
    } finally {
      setSavingName(false);
    }
  };

  const handlePickAvatar = async () => {
    setProfileError(null);
    if (user.isAnonymous) {
      setProfileError(t('settings.avatarNeedsAccount'));
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('settings.photoPermissionTitle'),
        t('settings.photoPermissionMessage'),
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settings.authExpired'));
      await uploadAvatar(
        user.id,
        token,
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );
      await refreshProfile();
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : t('settings.avatarUploadFailed'),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <SettingsScaffold
      onBack={() => router.replace('/settings')}
      title={t('settings.editProfile')}
    >
      <SettingsCard description={t('settings.profileEditHint')}>
        <View style={styles.avatarRow}>
          <Pressable
            accessibilityLabel={t('settings.changeAvatar')}
            disabled={uploadingAvatar}
            onPress={() => void handlePickAvatar()}
            style={styles.avatarWrapper}
          >
            {user.profile?.avatarUrl ? (
              <Image
                source={{ uri: user.profile.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.avatarHint}>
              {uploadingAvatar
                ? t('settings.uploading')
                : t('settings.tapToChange')}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t('settings.displayName')}</Text>
        <TextInput
          autoCapitalize="words"
          maxLength={30}
          onChangeText={setNameInput}
          onSubmitEditing={() => void handleSaveName()}
          placeholder={t('settings.displayName')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          style={styles.input}
          value={nameInput}
        />
        <Button
          disabled={!nameInput.trim() || nameInput.trim() === displayName}
          loading={savingName}
          onPress={() => void handleSaveName()}
        >
          {t('settings.save')}
        </Button>
        <Text style={styles.email}>
          {user.isAnonymous
            ? t('settings.guestAccount')
            : user.email ?? t('settings.noEmail')}
        </Text>
        {user.isAnonymous ? (
          <>
            <Button onPress={() => router.push('/upgrade-account')}>
              {t('settings.upgradeCta')}
            </Button>
            <Text style={styles.hint}>{t('settings.upgradeHint')}</Text>
          </>
        ) : null}
        {profileError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {profileError}
          </Text>
        ) : null}
      </SettingsCard>
    </SettingsScaffold>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loading: {
    color: colors.textMuted,
    fontSize: 16,
  },
  avatarRow: {
    alignItems: 'center',
  },
  avatarWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong,
  },
  avatarInitial: {
    color: colors.gold,
    fontSize: 32,
    fontWeight: '800',
  },
  avatarHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    backgroundColor: colors.backgroundElevated,
    fontSize: 17,
  },
  email: {
    color: colors.textMuted,
    fontSize: 15,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: colors.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
});
