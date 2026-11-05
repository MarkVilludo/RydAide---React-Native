import { Alert } from 'react-native';

/** Guard accidental taps on “Delete account” menu links. */
export function confirmBeforeDeleteAccountFlow(onContinue: () => void): void {
  Alert.alert(
    'Delete account?',
    'You are about to open account deletion. Nothing is deleted until you submit a request and we confirm it by email.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: onContinue },
    ],
  );
}

/** Final confirmation before sending a deletion request to the server. */
export function confirmSubmitDeletionRequest(onSubmit: () => void): void {
  Alert.alert(
    'Submit deletion request?',
    'We will process your request and email you when your account and personal data are removed. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit request', style: 'destructive', onPress: onSubmit },
    ],
  );
}
