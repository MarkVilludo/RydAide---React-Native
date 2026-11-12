import type { ImageSourcePropType } from 'react-native';

/** Native map `Marker` images (~30pt at default zoom) — custom views are unreliable on Google Maps. */
export const MAP_MARKER_IMAGES: Record<'customer' | 'mechanic', ImageSourcePropType> = {
  customer: require('../../assets/map/customer-pin.png'),
  mechanic: require('../../assets/map/mechanic-pin.png'),
};
