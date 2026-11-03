export type PushNotificationNavigation = {
  role: 'owner' | 'mechanic';
  screen: string;
  params?: Record<string, unknown>;
};
