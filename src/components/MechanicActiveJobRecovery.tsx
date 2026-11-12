import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchActiveJob } from '../api/mechanicHelp';
import { useAuth } from '../context/AuthContext';
import { navigateMechanicStackScreen } from '../navigation/nestedNavigate';
import {
  consumePendingNotificationNavigation,
  navigateFromNotification,
} from '../navigation/notificationNavigation';

export function MechanicActiveJobRecovery() {
  const { user } = useAuth();
  const coldStart = useRef(true);

  useEffect(() => {
    if (user?.role !== 'mechanic') {
      return;
    }

    const recover = async (navigateToActive: boolean) => {
      try {
        const pending = consumePendingNotificationNavigation();
        if (pending && pending.role === 'mechanic') {
          await navigateFromNotification(user, pending);
          return;
        }

        if (!navigateToActive) {
          return;
        }

        const job = await fetchActiveJob();
        if (job) {
          navigateMechanicStackScreen('ActiveJob', {
            helpRequestId: job.id,
            initialRequest: job,
          });
        }
      } catch {
        /* stay on dashboard — never crash the session on recovery */
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
