import { Alert, Platform } from 'react-native';
import { t } from '@/i18n';




/**
 * A guest (anonymous) account is unreachable after sign-out, so every sign-out
 * entry point must confirm first. react-native-web ships Alert as a no-op
 * stub, so the web build falls back to the browser's confirm dialog.
 */
export function confirmGuestSignOut(
  onConfirm: () => void,
  onDismiss?: () => void,
): void {
  if (Platform.OS === 'web') {
    const confirm = (
      globalThis as { confirm?: (message: string) => boolean }
    ).confirm;
    if (confirm?.(`${t('auth.signOutTitle')}\n\n${t('auth.guestSignOutMessage')}`)) {
      onConfirm();
    } else {
      onDismiss?.();
    }
    return;
  }

  Alert.alert(
    t('auth.signOutTitle'),
    t('auth.guestSignOutMessage'),
    [
      { text: t('common.cancel'), style: 'cancel', onPress: onDismiss },
      { text: t('auth.signOut'), style: 'destructive', onPress: onConfirm },
    ],
    // Android back-button dismissal skips the buttons entirely.
    { onDismiss },
  );
}
