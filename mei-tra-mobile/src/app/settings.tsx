import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { config } from '@/lib/config';
import { updateProfile, uploadAvatar } from '@/lib/profile-api';
import { colors } from '@/theme/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, loading, deleteAccount, signOut, getAccessToken, refreshProfile } =
    useAuth();
  const { connectionStatus, refreshRooms } = useGame();
  const { retryRegistration, status: notificationStatus } = useNotifications();
  const [signingOut, setSigningOut] = useState(false);
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

  if (!loading && !user) {
    return <Redirect href="/sign-in" />;
  }

  if (loading || !user) {
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.loading}>アカウント情報を読み込んでいます</Text>
      </Screen>
    );
  }

  const displayName =
    user.profile?.displayName ||
    user.profile?.username ||
    user.email?.split('@')[0] ||
    'Player';

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/sign-in');
    } finally {
      setSigningOut(false);
    }
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
            ? `参加中のルームが${roomCount}件あります。退出してから再試行してください。`
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
      setLinkError(`${label}を開けませんでした。もう一度お試しください。`);
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
      if (!token) throw new Error('認証が切れました');
      await updateProfile(user.id, token, { displayName: trimmed });
      await refreshProfile();
      setEditingName(false);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : '表示名の更新に失敗しました',
      );
    } finally {
      setSavingName(false);
    }
  };

  const handlePickAvatar = async () => {
    setProfileError(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '写真のアクセス許可',
        'アバターを変更するには、写真ライブラリへのアクセスを許可してください。',
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
      if (!token) throw new Error('認証が切れました');
      await uploadAvatar(
        user.id,
        token,
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
      );
      await refreshProfile();
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : 'アバターのアップロードに失敗しました',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const externalLinks = [
    {
      label: 'プライバシーポリシー',
      url: `${config.publicWebBaseUrl}/ja/privacy`,
    },
    {
      label: '利用規約',
      url: `${config.publicWebBaseUrl}/ja/terms`,
    },
    { label: 'お問い合わせ（運営会社）', url: config.supportUrl },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BrandHeader subtitle="アカウントと接続状態" />
          <Button
            accessibilityLabel="部屋一覧へ戻る"
            onPress={() => router.replace('/rooms')}
            style={styles.back}
            variant="ghost"
          >
            戻る
          </Button>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>プロフィール</Text>

          <View style={styles.avatarRow}>
            <Pressable
              accessibilityLabel="アバターを変更"
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
                {uploadingAvatar ? 'アップロード中...' : 'タップで変更'}
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
                placeholder="表示名"
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
                保存
              </Button>
              <Button
                disabled={savingName}
                onPress={() => setEditingName(false)}
                style={styles.cancelButton}
                variant="ghost"
              >
                取消
              </Button>
            </View>
          ) : (
            <Pressable
              accessibilityHint="タップして表示名を編集"
              onPress={handleStartEditName}
              style={styles.nameRow}
            >
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.editIcon}>編集</Text>
            </Pressable>
          )}

          <Text style={styles.email}>{user.email ?? 'メールアドレス未設定'}</Text>
          {profileError ? (
            <Text accessibilityRole="alert" style={styles.profileError}>
              {profileError}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>接続</Text>
          <ConnectionBanner status={connectionStatus} onRetry={refreshRooms} />
          <Text style={styles.hint}>
            対局中はアプリを前面に戻すと、最新のゲーム状態へ再同期します。
          </Text>
          <Text style={styles.hint}>
            対局通知:{' '}
            {notificationStatus === 'registered'
              ? '有効'
              : notificationStatus === 'permission-denied'
                ? '許可されていません'
                : notificationStatus === 'unsupported'
                  ? '実機で利用できます'
                  : '未登録'}
          </Text>
          {notificationStatus !== 'registered' &&
          notificationStatus !== 'unsupported' ? (
            <Button onPress={() => void retryRegistration()} variant="ghost">
              対局通知を再登録
            </Button>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>法的情報・サポート</Text>
          <Text style={styles.hint}>
            プライバシーポリシー、利用規約、お問い合わせはWebサイトで確認できます。
          </Text>
          <View style={styles.linkList}>
            {externalLinks.map(({ label, url }) => (
              <Pressable
                accessibilityHint="Webブラウザで開きます"
                accessibilityLabel={`${label}を開く`}
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
                  {openingLink === url ? `${label}を開いています…` : label}
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
          ログアウト
        </Button>
        <Button
          disabled={signingOut || deletingAccount}
          onPress={openDeleteModal}
          variant="ghost"
        >
          アカウントを削除
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
            <Text style={styles.modalTitle}>アカウントを削除</Text>
            <Text style={styles.modalWarning}>
              この操作は取り消せません。プロフィール、過去の記録、通知登録が削除されます。
              参加中のルームがある場合は先に退出してください。
            </Text>
            <Text style={styles.confirmationLabel}>
              確認のため DELETE と入力してください
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
                <Text style={styles.cancelLabel}>キャンセル</Text>
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
                  {deletingAccount ? '削除中…' : '完全に削除する'}
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
    color: '#ffb0a8',
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
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
    color: '#ffb0a8',
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
    color: '#ffb0a8',
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
