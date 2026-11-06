import { CommonActions } from '@react-navigation/native';
import type { MechanicStackParamList, OwnerStackParamList } from './types';
import { navigationRef } from './navigationRef';

function dispatchWhenReady(action: ReturnType<typeof CommonActions.navigate>): void {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(action);
    return;
  }
  const start = Date.now();
  const tick = () => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(action);
      return;
    }
    if (Date.now() - start < 8000) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/** Owner: Root → Drawer (OwnerMain) → Stack screen */
export function navigateOwnerStackScreen<S extends keyof OwnerStackParamList>(
  screen: S,
  params?: OwnerStackParamList[S],
): void {
  dispatchWhenReady(
    CommonActions.navigate({
      name: 'OwnerApp',
      params: {
        screen: 'OwnerMain',
        params: params !== undefined ? { screen, params } : { screen },
      },
    }),
  );
}

/** Mechanic: Root → Drawer (MechanicMain) → Stack screen */
export function navigateMechanicStackScreen<S extends keyof MechanicStackParamList>(
  screen: S,
  params?: MechanicStackParamList[S],
): void {
  dispatchWhenReady(
    CommonActions.navigate({
      name: 'MechanicApp',
      params: {
        screen: 'MechanicMain',
        params: params !== undefined ? { screen, params } : { screen },
      },
    }),
  );
}
