import type { PushNotificationNavigation } from '../types/pushNavigation';
import { fetchHelpRequest } from '../api/helpRequests';
import { fetchMechanicHelpRequest } from '../api/mechanicHelp';
import type { User } from '../api/types';
import { isOwnerLiveHelpRequest } from '../utils/helpRequestStatus';
import { navigateMechanicStackScreen, navigateOwnerStackScreen } from './nestedNavigate';
import { navigationRef } from './navigationRef';
import type { MechanicStackParamList, OwnerStackParamList } from './types';

export type PendingNotificationNav = PushNotificationNavigation & {
  helpRequestId?: number;
};

function parseNavigationField(raw: unknown): PushNotificationNavigation | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return parseNavigationField(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object') {
    return null;
  }
  const nav = raw as PushNotificationNavigation;
  if (nav.role !== 'owner' && nav.role !== 'mechanic') {
    return null;
  }
  if (typeof nav.screen !== 'string') {
    return null;
  }
  return nav;
}

function parseHelpRequestId(data: Record<string, unknown>): number | undefined {
  const raw = data.help_request_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

let pendingNotificationNav: PendingNotificationNav | null = null;

export function setPendingNotificationNavigation(nav: PendingNotificationNav | null): void {
  pendingNotificationNav = nav;
}

export function consumePendingNotificationNavigation(): PendingNotificationNav | null {
  const next = pendingNotificationNav;
  pendingNotificationNav = null;
  return next;
}

export function navigationFromPushData(data: Record<string, unknown> | undefined): PendingNotificationNav | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const nav = parseNavigationField(data.navigation);
  const helpRequestIdFromData = parseHelpRequestId(data);
  if (!nav) {
    if (!helpRequestIdFromData) {
      return null;
    }
    return {
      role: 'owner',
      screen: 'ActiveHelpRequest',
      params: { helpRequestId: helpRequestIdFromData },
      helpRequestId: helpRequestIdFromData,
    };
  }
  const helpRequestId =
    typeof (nav.params as { helpRequestId?: number } | undefined)?.helpRequestId === 'number'
      ? (nav.params as { helpRequestId: number }).helpRequestId
      : helpRequestIdFromData;

  return { ...nav, helpRequestId };
}

export async function navigateFromNotification(user: User, nav: PendingNotificationNav): Promise<void> {
  if (!navigationRef.isReady()) {
    setPendingNotificationNavigation(nav);
    return;
  }

  if (nav.role !== user.role) {
    return;
  }

  const helpRequestId = nav.helpRequestId ?? (nav.params?.helpRequestId as number | undefined);

  if (helpRequestId != null) {
    try {
      if (user.role === 'owner') {
        const request = await fetchHelpRequest(helpRequestId);
        const screen = isOwnerLiveHelpRequest(request) ? 'ActiveHelpRequest' : 'HelpRequestDetail';
        navigateOwnerStackScreen(screen, { helpRequestId });
        return;
      }

      const request = await fetchMechanicHelpRequest(helpRequestId);
      const jobStatus = request.job_status ?? request.job?.status ?? request.status;
      const activeJob = ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(jobStatus);
      let screen = nav.screen;
      if (activeJob) {
        screen = 'ActiveJob';
      } else if (screen === 'MechanicRequests' && nav.params?.tab) {
        screen = 'MechanicRequests';
      }

      if (screen === 'ActiveJob') {
        navigateMechanicStackScreen('ActiveJob', { helpRequestId, initialRequest: request });
      } else if (screen === 'MechanicRequests') {
        navigateMechanicStackScreen('MechanicRequests', {
          tab:
            (nav.params?.tab as MechanicStackParamList['MechanicRequests']['tab']) ??
            'cancelled_expired',
        });
      } else if (screen === 'IncomingRequestDetail') {
        navigateMechanicStackScreen('IncomingRequestDetail', { helpRequestId });
      } else {
        navigateMechanicStackScreen('MechanicRequestDetail', { helpRequestId });
      }
      return;
    } catch {
      /* stale — fall through */
    }
  }

  if (user.role === 'owner') {
    navigateOwnerStackScreen(
      nav.screen as keyof OwnerStackParamList,
      nav.params as OwnerStackParamList[keyof OwnerStackParamList],
    );
  } else {
    navigateMechanicStackScreen(
      nav.screen as keyof MechanicStackParamList,
      nav.params as MechanicStackParamList[keyof MechanicStackParamList],
    );
  }
}
