import React, { useCallback, useState } from 'react';
import {
  InAppDirectionsModal,
  type DirectionsDestination,
} from '../components/InAppDirectionsModal';

export function useInAppDirections() {
  const [destination, setDestination] = useState<DirectionsDestination | null>(null);

  const openInAppDirections = useCallback(
    (latitude: number, longitude: number, label?: string) => {
      setDestination({ latitude, longitude, label });
    },
    [],
  );

  const closeInAppDirections = useCallback(() => {
    setDestination(null);
  }, []);

  const directionsModal = (
    <InAppDirectionsModal
      visible={destination != null}
      destination={destination}
      onClose={closeInAppDirections}
    />
  );

  return { openInAppDirections, closeInAppDirections, directionsModal };
}