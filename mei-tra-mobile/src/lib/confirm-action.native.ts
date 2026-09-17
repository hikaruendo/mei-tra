import { Alert } from 'react-native';

import type { ConfirmActionOptions } from './confirm-action';
import { t } from '@/i18n';

/** Asks before an action that cannot be taken back. */
export function confirmAction({
  title,
  message,
  confirmLabel,
  onConfirm,
  onDismiss,
}: ConfirmActionOptions): void {
  Alert.alert(
    title,
    message,
    [
      { text: t('common.cancel'), style: 'cancel', onPress: onDismiss },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ],
    // Android back-button dismissal skips the buttons entirely.
    { onDismiss },
  );
}
