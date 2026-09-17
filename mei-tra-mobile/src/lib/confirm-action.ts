export interface ConfirmActionOptions {
  title: string;
  message: string;
  /** The label of the button that goes ahead. The browser dialog has no custom labels. */
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss?: () => void;
}

/**
 * Asks before an action that cannot be taken back. react-native-web ships
 * Alert as a no-op stub, so the web build uses the browser's confirm dialog.
 */
export function confirmAction({
  title,
  message,
  onConfirm,
  onDismiss,
}: ConfirmActionOptions): void {
  const confirm = (globalThis as { confirm?: (message: string) => boolean })
    .confirm;
  if (confirm?.(`${title}\n\n${message}`)) {
    onConfirm();
  } else {
    onDismiss?.();
  }
}
