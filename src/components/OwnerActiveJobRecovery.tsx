import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchActiveHelpRequest } from '../api/helpRequests';
import { useAuth } from '../context/AuthContext';
import { navigateOwnerStackScreen } from '../navigation/nestedNavigate';
import {
  consumePendingNotificationNavigation,
  navigateFromNotification,
} from '../navigation/notificationNavigation';
import { isOwnerLiveHelpRequest } from '../utils/helpRequestStatus';

export function OwnerActiveJobRecovery() {
  const { user } = useAuth();
  const coldStart = useRef(true);

  useEffect(() => {
    if (user?.role !== 'owner') {
      return;
    }

    const recover = async (navigateToActive: boolean) => {
      try {
        const pending = consumePendingNotificationNavigation();
        if (pending && pending.role === 'owner') {
          await navigateFromNotification(user, pending);
          return;
        }

        if (!navigateToActive) {
          return;
        }

        const active = await fetchActiveHelpRequest();
        if (active && isOwnerLiveHelpRequest(active)) {
          navigateOwnerStackScreen('ActiveHelpRequest', { helpRequestId: active.id });
        }
      } catch {
        /* stay on current screen — never crash the session on recovery */
      }
    };

    let coldStartTimer: ReturnType<typeof setTimeout> | undefined;
    if (coldStart.current) {
      coldStart.current = false;
      coldStartTimer = setTimeout(() => {
        void recover(true);
      }, 400);
    }

    const onState = (state: AppStateStatus) => {
      if (state === 'active') {
        void recover(false);
      }
    };
    const sub = AppState.addEventListener('change', onState);
    return () => {
      if (coldStartTimer) clearTimeout(coldStartTimer);
      sub.remove();
    };
  }, [user]);

  return null;
}
