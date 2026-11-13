import { Alert } from 'react-native';
import { showAppToast } from '../AppToast';

/** Short success/info message (toast on Android, banner on iOS). */
export const notify = showAppToast;

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for removals/irreversible actions. */
  destructive?: boolean;
};

/**
 * Standard confirmation dialog. Resolves true when the user confirms.
 * Name the thing and the consequence in the message ("Remove Toyota Vios? Past requests are kept.").
 */
export function confirmAction({
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Blocking error with a single OK — use for failed actions the user must notice. */
export function showError(title: string, message: string) {
  Alert.alert(title, message);
}
