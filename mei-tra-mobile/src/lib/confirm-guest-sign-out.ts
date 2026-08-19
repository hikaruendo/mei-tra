import { Alert, Platform } from 'react-native';

const TITLE = 'ログアウトしますか？';
const MESSAGE =
  'ゲストアカウントはログアウトすると二度とアクセスできず、戦績も失われます。残したい場合は先にアカウント登録をしてください。';

/**
 * A guest (anonymous) account is unreachable after sign-out, so every sign-out
 * entry point must confirm first. react-native-web ships Alert as a no-op
 * stub, so the web build falls back to the browser's confirm dialog.
 */
export function confirmGuestSignOut(onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    const confirm = (
      globalThis as { confirm?: (message: string) => boolean }
    ).confirm;
    if (confirm?.(`${TITLE}\n\n${MESSAGE}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(TITLE, MESSAGE, [
    { text: 'キャンセル', style: 'cancel' },
    { text: 'ログアウト', style: 'destructive', onPress: onConfirm },
  ]);
}
