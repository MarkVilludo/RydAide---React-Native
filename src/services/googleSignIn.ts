import { Platform } from 'react-native';
import { googleIosClientId, googleWebClientId, isGoogleSignInConfiguredLocally } from '../config/googleSignIn';

let configured = false;
let configuredKey = '';

type GoogleClientIds = {
  webClientId?: string | null;
  iosClientId?: string | null;
};

/** Lazy-loaded so Login can mount without touching TurboModules at import time (dev client / Expo Go). */
async function loadGoogleSignInLib() {
  return import('@react-native-google-signin/google-signin');
}

function resolveClientIds(overrides?: GoogleClientIds): { web: string; ios?: string } | null {
  const web = overrides?.webClientId?.trim() || googleWebClientId();
  if (!web) return null;
  const ios = overrides?.iosClientId?.trim() || googleIosClientId();
  if (Platform.OS === 'ios' && !ios) return null;
  return ios ? { web, ios } : { web };
}

async function ensureConfigured(overrides?: GoogleClientIds): Promise<void> {
  const ids = resolveClientIds(overrides);
  if (!ids) {
    throw new Error('Google sign-in is not configured (missing OAuth client IDs).');
  }
  const key = `${ids.web}|${ids.ios ?? ''}`;
  if (configured && configuredKey === key) return;
  const { GoogleSignin } = await loadGoogleSignInLib();
  GoogleSignin.configure({
    webClientId: ids.web,
    ...(ids.ios ? { iosClientId: ids.ios } : {}),
    offlineAccess: false,
  });
  configured = true;
  configuredKey = key;
}

function isMissingNativeModuleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('RNGoogleSignin') || message.includes('TurboModuleRegistry');
}

export function googleSignInAvailable(
  serverEnabled: boolean | undefined,
  serverClients?: GoogleClientIds,
): boolean {
  if (!serverEnabled) return false;
  if (resolveClientIds(serverClients)) return true;
  return isGoogleSignInConfiguredLocally();
}

export type GoogleSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled?: boolean; message?: string };

/** Native Google account picker → ID token for POST /auth/google. */
export async function requestGoogleIdToken(overrides?: GoogleClientIds): Promise<GoogleSignInResult> {
  try {
    await ensureConfigured(overrides);
    const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await loadGoogleSignInLib();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return { ok: false, cancelled: true };
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      return {
        ok: false,
        message: 'Google did not return a sign-in token. Check OAuth client IDs in Google Cloud Console.',
      };
    }
    return { ok: true, idToken };
  } catch (error) {
    if (isMissingNativeModuleError(error)) {
      return {
        ok: false,
        message:
          'Google Sign-In is not available in this build. Use the RydAid dev app from npm run android (not Expo Go), then rebuild.',
      };
    }
    try {
      const { isErrorWithCode, statusCodes } = await loadGoogleSignInLib();
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          return { ok: false, cancelled: true };
        }
        if (error.code === statusCodes.IN_PROGRESS) {
          return { ok: false, message: 'Google sign-in is already in progress.' };
        }
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          return { ok: false, message: 'Google Play services are not available on this device.' };
        }
      }
    } catch {
      /* ignore secondary load errors */
    }
    const message = error instanceof Error ? error.message : 'Google sign-in failed.';
    return { ok: false, message };
  }
}