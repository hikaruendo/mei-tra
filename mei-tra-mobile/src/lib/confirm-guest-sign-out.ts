import { confirmAction } from '@/lib/confirm-action';
import { t } from '@/i18n';

/**
 * A guest (anonymous) account is unreachable after sign-out, so every sign-out
 * entry point must confirm first.
 */
export function confirmGuestSignOut(
  onConfirm: () => void,
  onDismiss?: () => void,
): void {
  confirmAction({
    title: t('auth.signOutTitle'),
    message: t('auth.guestSignOutMessage'),
    confirmLabel: t('auth.signOut'),
    onConfirm,
    onDismiss,
  });
}
