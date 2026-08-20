import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
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
import { confirmGuestSignOut } from '@/lib/confirm-guest-sign-out';
import { colors } from '@/theme/colors';

export default function AccountSettingsScreen() {
  useLocale();
  const router = useRouter();
  const { user, loading, deleteAccount, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    if (user.isAnonymous) {
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

  return (
    <>
      <SettingsScaffold
        onBack={() => router.replace('/settings')}
        title={t('settings.accountManagement')}
      >
        <SettingsCard title={t('settings.account')}>
          <Text style={styles.label}>{t('settings.emailAddress')}</Text>
          <Text style={styles.email}>
            {user.isAnonymous
              ? t('settings.guestAccount')
              : user.email ?? t('settings.noEmail')}
          </Text>
          {user.isAnonymous ? (
            <Button onPress={() => router.push('/upgrade-account')}>
              {t('settings.upgradeCta')}
            </Button>
          ) : null}
          <Button
            loading={signingOut}
            onPress={() => void handleSignOut()}
            variant="secondary"
          >
            {t('settings.signOut')}
          </Button>
        </SettingsCard>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>{t('settings.deleteAccount')}</Text>
          <Text style={styles.dangerHint}>{t('settings.deleteEntryHint')}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={signingOut || deletingAccount}
            onPress={openDeleteModal}
            style={({ pressed }) => [
              styles.deleteEntry,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.deleteEntryLabel}>
              {t('settings.deleteAccount')}
            </Text>
          </Pressable>
        </View>
      </SettingsScaffold>

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
            <Text style={styles.modalWarning}>{t('settings.deleteWarning')}</Text>
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
                  disabled: confirmationText !== 'DELETE' || deletingAccount,
                  busy: deletingAccount,
                }}
                disabled={confirmationText !== 'DELETE' || deletingAccount}
                onPress={() => void handleDeleteAccount()}
                style={[
                  styles.deleteAction,
                  (confirmationText !== 'DELETE' || deletingAccount) &&
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
    </>
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
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  email: {
    color: colors.text,
    fontSize: 16,
  },
  dangerZone: {
    gap: 8,
    marginTop: 28,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dangerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dangerHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  deleteEntry: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSubtle,
  },
  deleteEntryLabel: {
    color: colors.dangerText,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
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
    maxWidth: 520,
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
    color: colors.onDanger,
    fontSize: 15,
    fontWeight: '800',
  },
});
