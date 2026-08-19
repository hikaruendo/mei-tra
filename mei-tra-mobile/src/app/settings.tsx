import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import type { Team } from '@meitra/contracts/game';
import { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';
import { useNotifications } from '@/context/NotificationContext';
import { useProfileGameHistory } from '@/hooks/useProfileGameHistory';
import { config } from '@/lib/config';
import { confirmGuestSignOut } from '@/lib/confirm-guest-sign-out';
import { updateProfile, uploadAvatar } from '@/lib/profile-api';
import { getTeamDisplayName } from '@/lib/team-labels';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, loading, deleteAccount, signOut, getAccessToken, refreshProfile } =
    useAuth();
  const { connectionStatus, refreshRooms } = useGame();
  const { retryRegistration, status: notificationStatus } = useNotifications();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [openingLink, setOpeningLink] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingAnimation, setSavingAnimation] = useState(false);
  // Mirrors the saved value so the switch responds before the profile reloads.
  const [animationOverride, setAnimationOverride] = useState<boolean | null>(
    null,
  );
  const {
    items: recentMatches,
    loading: historyLoading,
    error: historyError,
    refresh: refreshHistory,
  } = useProfileGameHistory(user?.id ?? null);

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

  const displayName =
    user.profile?.displayName ||
    user.profile?.username ||
    user.email?.split('@')[0] ||
    'Player';

  const startPlayerAnimation =
    animationOverride ?? user.profile?.startPlayerAnimation ?? true;

  const performSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/sign-in');
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut || confirmingSignOut) return;

    // A guest account is unreachable after sign-out, so confirm before losing it.
    if (user?.isAnonymous) {
      setConfirmingSignOut(true);
      confirmGuestSignOut(
        () => void performSignOut(),
        () => setConfirmingSignOut(false),
      );
      return;
    }

    await performSignOut();
  };

  const openDeleteModal = () => {
    setConfirmationText('');
    setDeleteError(null);
    setDeleteModalVisible(true);
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount || confirmationText !== 'DELETE') return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const result = await deleteAccount();
      if (result.error) {
        const roomCount = result.error.activeRoomCount;
        setDeleteError(
          result.error.kind === 'active-room' && roomCount
            ? t('settings.activeRoomBlocked', { count: roomCount })
            : result.error.message,
        );
        return;
      }

      setDeleteModalVisible(false);
      router.replace('/sign-in');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleOpenLink = async (url: string, label: string) => {
    if (openingLink) return;
    setOpeningLink(url);
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError(t('settings.linkOpenFailed', { label }));
    } finally {
      setOpeningLink(null);
    }
  };

  const handleStartEditName = () => {
    setNameInput(displayName);
    setProfileError(null);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === displayName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    setProfileError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settings.authExpired'));
      await updateProfile(user.id, token, { displayName: trimmed });
      await refreshProfile();
      setEditingName(false);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : t('settings.displayNameUpdateFailed'),
      );
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleAnimation = async (next: boolean) => {
    setSavingAnimation(true);
    setProfileError(null);
    setAnimationOverride(next);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error(t('settings.authExpired'));
      await updateProfile(user.id, token, {
        preferences: { startPlayerAnimation: next },
      });
      await refreshProfile();
      setAnimationOverride(null);
    } catch (err) {
      setAnimationOverride(null);
      setProfileError(
        err instanceof Error ? err.message : t('settings.settingUpdateFailed'),
      );
    } finally {
      setSavingAnimation(false);
    }
  };

  const handlePickAvatar = async () => {
    setProfileError(null);
    // Guest uploads would outlive the account on a public bucket; the backend
    // and storage RLS reject them, so do not open the picker at all.
    if (user.isAnonymous) {
      setProfileError(
        t('settings.avatarNeedsAccount'),
      );
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
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : t('settings.avatarUploadFailed'),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const externalLinks = [
    {
      label: t('settings.privacyPolicy'),
      url: `${config.publicWebBaseUrl}/ja/privacy`,
    },
    {
      label: t('settings.terms'),
      url: `${config.publicWebBaseUrl}/ja/terms`,
    },
    { label: t('settings.support'), url: config.supportUrl },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BrandHeader subtitle={t('settings.subtitle')} />
          <Button
            accessibilityLabel={t('settings.backToRooms')}
            onPress={() => router.replace('/rooms')}
            style={styles.back}
            variant="ghost"
          >
            {t('settings.back')}
          </Button>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{t('settings.recentGames')}</Text>
              <Text style={styles.hint}>{t('settings.recentGamesHint')}</Text>
            </View>
            <Button
              disabled={historyLoading}
              onPress={() => void refreshHistory()}
              style={styles.refreshButton}
              variant="ghost"
            >
              {t('settings.refresh')}
            </Button>
          </View>

          {historyLoading && recentMatches.length === 0 ? (
            <Text style={styles.historyStatus}>{t('settings.historyLoading')}</Text>
          ) : null}
          {!historyLoading && historyError ? (
            <Text accessibilityRole="alert" style={styles.profileError}>
              {t('settings.historyFailed')}
            </Text>
          ) : null}
          {!historyLoading && !historyError && recentMatches.length === 0 ? (
            <Text style={styles.historyStatus}>{t('settings.historyEmpty')}</Text>
          ) : null}

          {recentMatches.map((match) => {
            const completedAt = new Date(match.completedAt);
            const winner =
              match.winningTeam === 0 || match.winningTeam === 1
                ? getTeamDisplayName(
                    match.winningTeam as Team,
                    match.teamNames,
                  )
                : t('settings.winnerUndecided');

            return (
              <Pressable
                accessibilityHint={t('settings.historyHint')}
                accessibilityRole="button"
                key={match.roomId}
                onPress={() =>
                  router.push({
                    pathname: '/game-history/[roomId]',
                    params: { roomId: match.roomId },
                  })
                }
                style={({ pressed }) => [
                  styles.historyItem,
                  pressed && styles.linkPressed,
                ]}
              >
                <View style={styles.historyItemHeader}>
                  <Text numberOfLines={1} style={styles.historyRoomName}>
                    {match.roomName}
                  </Text>
                  <Text style={styles.historyDate}>
                    {Number.isNaN(completedAt.getTime())
                      ? match.completedAt
                      : completedAt.toLocaleString('ja-JP')}
                  </Text>
                </View>
                <View style={styles.historyMeta}>
                  <Text style={styles.historyMetaText}>
                    {t('settings.rounds', { count: match.roundCount })}
                  </Text>
                  <Text style={styles.historyMetaText}>
                    {t('settings.winner', { name: winner })}
                  </Text>
                </View>
                <Text style={styles.historyDetails}>{t('settings.viewDetails')}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.profile')}</Text>

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

          {editingName ? (
            <View style={styles.editNameRow}>
              <TextInput
                autoFocus
                maxLength={30}
                onChangeText={setNameInput}
                onSubmitEditing={() => void handleSaveName()}
                placeholder={t('settings.displayName')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={styles.nameInput}
                value={nameInput}
              />
              <Button
                disabled={savingName || !nameInput.trim()}
                loading={savingName}
                onPress={() => void handleSaveName()}
                style={styles.saveButton}
              >
                {t('settings.save')}
              </Button>
              <Button
                disabled={savingName}
                onPress={() => setEditingName(false)}
                style={styles.cancelButton}
                variant="ghost"
              >
                {t('settings.cancelShort')}
              </Button>
            </View>
          ) : (
            <Pressable
              accessibilityHint={t('settings.tapToEditName')}
              onPress={handleStartEditName}
              style={styles.nameRow}
            >
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.editIcon}>{t('settings.edit')}</Text>
            </Pressable>
          )}

          {user.isAnonymous ? (
            <>
              <Text style={styles.email}>{t('settings.guestAccount')}</Text>
              <Button onPress={() => router.push('/upgrade-account')}>
                {t('settings.upgradeCta')}
              </Button>
              <Text style={styles.hint}>
                {t('settings.upgradeHint')}
              </Text>
            </>
          ) : (
            <Text style={styles.email}>
              {user.email ?? t('settings.noEmail')}
            </Text>
          )}
          {profileError ? (
            <Text accessibilityRole="alert" style={styles.profileError}>
              {profileError}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.game')}</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>
              {t('settings.jankenToggle')}
            </Text>
            <Switch
              disabled={savingAnimation}
              onValueChange={(value) => void handleToggleAnimation(value)}
              value={startPlayerAnimation}
            />
          </View>
          <Text style={styles.hint}>
            {t('settings.jankenHint')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.connection')}</Text>
          <ConnectionBanner status={connectionStatus} onRetry={refreshRooms} />
          <Text style={styles.hint}>
            {t('settings.resyncHint')}
          </Text>
          <Text style={styles.hint}>
            {t('settings.notificationsLabel')}{' '}
            {notificationStatus === 'registered'
              ? t('settings.notifEnabled')
              : notificationStatus === 'permission-denied'
                ? t('settings.notifDenied')
                : notificationStatus === 'unsupported'
                  ? t('settings.notifDeviceOnly')
                  : t('settings.notifUnregistered')}
          </Text>
          {notificationStatus !== 'registered' &&
          notificationStatus !== 'unsupported' ? (
            <Button onPress={() => void retryRegistration()} variant="ghost">
              {t('settings.retryNotifications')}
            </Button>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
          <Text style={styles.hint}>
            {t('settings.legalHint')}
          </Text>
          <View style={styles.linkList}>
            {externalLinks.map(({ label, url }) => (
              <Pressable
                accessibilityHint={t('settings.openInBrowser')}
                accessibilityLabel={t('settings.openLabel', { label })}
                accessibilityRole="link"
                accessibilityState={{ disabled: Boolean(openingLink) }}
                disabled={Boolean(openingLink)}
                key={url}
                onPress={() => void handleOpenLink(url, label)}
                style={({ pressed }) => [
                  styles.link,
                  pressed && styles.linkPressed,
                ]}
              >
                <Text style={styles.linkLabel}>
                  {openingLink === url
                    ? t('settings.openingLabel', { label })
                    : label}
                </Text>
              </Pressable>
            ))}
          </View>
          {linkError ? (
            <Text accessibilityRole="alert" style={styles.linkError}>
              {linkError}
            </Text>
          ) : null}
        </View>

        <Button loading={signingOut} onPress={handleSignOut} variant="danger">
          {t('settings.signOut')}
        </Button>
        <Button
          disabled={signingOut || deletingAccount}
          onPress={openDeleteModal}
          variant="ghost"
        >
          {t('settings.deleteAccount')}
        </Button>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deletingAccount) setDeleteModalVisible(false);
        }}
        transparent
        visible={deleteModalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings.deleteAccount')}</Text>
            <Text style={styles.modalWarning}>
              {t('settings.deleteWarning')}
            </Text>
            <Text style={styles.confirmationLabel}>
              {t('settings.deleteConfirmLabel')}
            </Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deletingAccount}
              onChangeText={setConfirmationText}
              placeholder="DELETE"
              placeholderTextColor={colors.textMuted}
              style={styles.confirmationInput}
              value={confirmationText}
            />
            {deleteError ? (
              <Text accessibilityRole="alert" style={styles.deleteError}>
                {deleteError}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={deletingAccount}
                onPress={() => setDeleteModalVisible(false)}
                style={styles.cancelAction}
              >
                <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled:
                    deletingAccount || confirmationText !== 'DELETE',
                  busy: deletingAccount,
                }}
                disabled={deletingAccount || confirmationText !== 'DELETE'}
                onPress={() => void handleDeleteAccount()}
                style={[
                  styles.deleteAction,
                  (deletingAccount || confirmationText !== 'DELETE') &&
                    styles.disabledAction,
                ]}
              >
                <Text style={styles.deleteLabel}>
                  {deletingAccount
                    ? t('settings.deleting')
                    : t('settings.deleteFinal')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
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
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  back: {
    minHeight: 42,
    paddingHorizontal: 12,
  },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  sectionTitle: {
    color: colors.gold,
    fontSize: 19,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeading: {
    flex: 1,
    gap: 4,
  },
  refreshButton: {
    minHeight: 40,
    paddingHorizontal: 10,
  },
  historyStatus: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  historyItem: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panelStrong,
  },
  historyItemHeader: {
    gap: 4,
  },
  historyRoomName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  historyDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
  historyMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  historyMetaText: {
    color: colors.text,
    fontSize: 13,
  },
  historyDetails: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  avatarRow: {
    alignItems: 'center',
  },
  avatarWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong,
  },
  avatarInitial: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
  },
  avatarHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  editIcon: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    backgroundColor: colors.backgroundElevated,
    fontSize: 17,
  },
  saveButton: {
    minHeight: 44,
    paddingHorizontal: 14,
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 10,
  },
  email: {
    color: colors.textMuted,
    fontSize: 15,
  },
  profileError: {
    color: colors.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  linkList: {
    gap: 10,
  },
  link: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.panelStrong,
  },
  linkPressed: {
    opacity: 0.78,
  },
  linkLabel: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  linkError: {
    color: colors.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    width: '100%',
    gap: 14,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  modalWarning: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  confirmationLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmationInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    backgroundColor: colors.panel,
    fontSize: 17,
  },
  deleteError: {
    color: colors.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.danger,
  },
  disabledAction: {
    opacity: 0.45,
  },
  deleteLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
