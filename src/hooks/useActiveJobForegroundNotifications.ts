import { useEffect } from 'react';
import { showAppToast } from '../components/AppToast';
import { getExpoNotificationsModule } from '../services/expoNotificationsSafe';

function parseHelpRequestId(data: Record<string, unknown> | undefined): number | null {
  if (!data) return null;
  const raw = data.help_request_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** While on a live job, toast + refresh when a matching push arrives in the foreground. */
export function useActiveJobForegroundNotifications(
  helpRequestId: number | null | undefined,
  onRefresh: () => void,
) {
  useEffect(() => {
    const Notifications = getExpoNotificationsModule();
    if (!helpRequestId || !Notifications) {
      return;
    }
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const id = parseHelpRequestId(data);
      if (id !== helpRequestId) {
        return;
      }
      const body = notification.request.content.body;
      const title = notification.request.content.title;
      showAppToast(typeof body === 'string' && body.trim() ? body : title ?? 'Job update');
      onRefresh();
    });
    return () => sub.remove();
  }, [helpRequestId, onRefresh]);
}