import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { getCachedAppConfig } from '../api/appConfig';
import { navigateMechanicStackScreen, navigateOwnerStackScreen } from '../navigation/nestedNavigate';
import { problemReportMailto } from '../screens/account/ContactSupportScreen';
import { resolveSupportContacts } from './supportContacts';

function platformLabel(): string {
  return Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
}

/** Opens the mail app with a structured problem report (works before sign-in). */
export function openSupportEmail(category: string, description = ''): void {
  const contacts = resolveSupportContacts(getCachedAppConfig());
  const version = Constants.expoConfig?.version ?? '—';
  const url = problemReportMailto(contacts.email, category, description || 'I need help with RydAid.', {
    role: 'unknown',
    accountId: null,
    version,
    platform: platformLabel(),
  });
  void Linking.openURL(url).catch(() => {
    void Linking.openURL(`mailto:${contacts.email}`).catch(() => {});
  });
}

export function openSupportFaq(): void {
  const faq = resolveSupportContacts(getCachedAppConfig()).faqUrl;
  if (!faq) return;
  void Linking.openURL(faq).catch(() => {});
}

export function openSupportPhone(): void {
  const phone = resolveSupportContacts(getCachedAppConfig()).phone;
  if (!phone) return;
  const dial = phone.replace(/[^\d+]/g, '');
  void Linking.openURL(`tel:${dial}`).catch(() => {});
}

export function navigateToContactSupport(role: 'owner' | 'mechanic'): void {
  if (role === 'owner') {
    navigateOwnerStackScreen('ContactSupport');
  } else {
    navigateMechanicStackScreen('ContactSupport');
  }
}