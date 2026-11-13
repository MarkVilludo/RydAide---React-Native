import * as SecureStore from 'expo-secure-store';

/** Last email used to sign in on this device (never the password). */
const KEY = 'rydaid.lastLoginEmail';

export async function loadLastLoginEmail(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(KEY))?.trim() || null;
  } catch {
    return null;
  }
}

export async function saveLastLoginEmail(email: string): Promise<void> {
  try {
    if (email.trim()) await SecureStore.setItemAsync(KEY, email.trim());
  } catch {
    /* best effort */
  }
}
