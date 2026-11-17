import Constants from 'expo-constants';
import { Platform } from 'react-native';

function readExtra(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra = extra?.[key];
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  return undefined;
}

export function googleWebClientId(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || readExtra('googleWebClientId');
}

export function googleIosClientId(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || readExtra('googleIosClientId');
}

/** Reversed client ID for the iOS URL scheme (GoogleSignIn config plugin). */
export function googleIosUrlScheme(iosClientId: string): string {
  const suffix = '.apps.googleusercontent.com';
  const prefix = iosClientId.endsWith(suffix) ? iosClientId.slice(0, -suffix.length) : iosClientId;
  return `com.googleusercontent.apps.${prefix}`;
}

export function isGoogleSignInConfiguredLocally(): boolean {
  const web = googleWebClientId();
  if (!web) return false;
  if (Platform.OS === 'ios') return !!googleIosClientId();
  return true;
}