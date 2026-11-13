import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { androidMapsProvider } from '../utils/mapsProvider';

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  /** Stretch to fill parent instead of a fixed height. */
  fill?: boolean;
};

export const MechanicLocationMapPreview = React.memo(function MechanicLocationMapPreview({
  latitude,
  longitude,
  height = 132,
  fill,
}: Props) {
  const region = useMemo(
    () => ({
      latitude,
      longitude,
      latitudeDelta: 0.011,
      longitudeDelta: 0.011,
    }),
    [latitude, longitude],
  );

  // iOS follows the `region` prop, so never remount there. Android lite mode renders a static
  // snapshot, so remount it — but only when the pin moves ~10 m, not on GPS jitter.
  const mapKey = Platform.OS === 'android' ? `${latitude.toFixed(4)}_${longitude.toFixed(4)}` : 'map';

  return (
    <View style={[styles.shell, fill ? styles.shellFill : { height }]} collapsable={false}>
      <MapView
        key={mapKey}
        style={styles.map}
        provider={androidMapsProvider()}
        initialRegion={region}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        liteMode={Platform.OS === 'android'}
        loadingEnabled
        moveOnMarkerPress={false}
      >
        <Marker coordinate={{ latitude, longitude }} pinColor="#0284c7" />
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  shellFill: {
    flex: 1,
    minHeight: 0,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
