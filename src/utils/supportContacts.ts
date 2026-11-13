import type { AppConfig } from '../api/appConfig';

export type SupportContacts = {
  email: string | null;
  phone: string | null;
  messengerUrl: string | null;
  faqUrl: string | null;
  hours: string | null;
};

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Server app-config (RYDAID_SUPPORT_* in Laravel .env) wins; EXPO_PUBLIC_SUPPORT_* in the app .env is the
 * fallback until the server is deployed. Nothing is hard-coded — unset options are hidden.
 */
export function resolveSupportContacts(config: AppConfig | null | undefined): SupportContacts {
  const s = config?.support ?? null;
  return {
    email: clean(s?.email) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
    phone: clean(s?.phone) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_PHONE),
    messengerUrl: clean(s?.messenger_url) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_MESSENGER_URL),
    faqUrl: clean(s?.faq_url) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_FAQ_URL),
    hours: clean(s?.hours) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_HOURS),
  };
}

export function hasAnySupportContact(c: SupportContacts): boolean {
  return Boolean(c.email || c.phone || c.messengerUrl || c.faqUrl);
}
