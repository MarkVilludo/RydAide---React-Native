import { useContext } from 'react';
import { MechanicLocationContext, type MechanicLocationContextValue } from './mechanicLocationState';

export function useMechanicLiveLocation(): MechanicLocationContextValue {
  return useContext(MechanicLocationContext);
}
