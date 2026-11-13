import type { AppConfig } from '../api/appConfig';

export type SupportContacts = {
  email: string;
  phone: string | null;
  messengerUrl: string | null;
  faqUrl: string | null;
  hours: string | null;
};

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Platform problem reports go here unless the server or app .env sets another address. */
export const DEFAULT_SUPPORT_EMAIL = 'devsupport@quantumrealm.tech';

/**
 * Server app-config (RYDAID_SUPPORT_* in Laravel .env) wins; EXPO_PUBLIC_SUPPORT_* in the app .env is the
 * fallback until the server is deployed. Email always resolves (DEFAULT_SUPPORT_EMAIL); phone, Messenger,
 * FAQ and hours stay hidden unless set.
 */
export function resolveSupportContacts(config: AppConfig | null | undefined): SupportContacts {
  const s = config?.support ?? null;
  return {
    email: clean(s?.email) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_EMAIL) ?? DEFAULT_SUPPORT_EMAIL,
    phone: clean(s?.phone) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_PHONE),
    messengerUrl: clean(s?.messenger_url) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_MESSENGER_URL),
    faqUrl: clean(s?.faq_url) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_FAQ_URL),
    hours: clean(s?.hours) ?? clean(process.env.EXPO_PUBLIC_SUPPORT_HOURS),
  };
}

export function hasAnySupportContact(c: SupportContacts): boolean {
  return Boolean(c.email || c.phone || c.messengerUrl || c.faqUrl);
}
