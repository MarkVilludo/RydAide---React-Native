import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchActiveJob } from '../api/mechanicHelp';
import { useAuth } from '../context/AuthContext';
import { markLaunchStep } from '../utils/launchSteps';
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
      // Runs under the launch loading screen, which waits for it — so a redirect to the
      // active job happens before anything is shown (no dashboard → job flash).
      coldStartTimer = setTimeout(() => {
        void recover(true).finally(() => markLaunchStep('recovery'));
      }, 100);
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
