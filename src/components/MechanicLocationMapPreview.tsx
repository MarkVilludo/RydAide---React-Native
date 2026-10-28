import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
};

export function MechanicLocationMapPreview({ latitude, longitude, height = 132 }: Props) {
  const region = useMemo(
    () => ({
      latitude,
      longitude,
      latitudeDelta: 0.011,
      longitudeDelta: 0.011,
    }),
    [latitude, longitude],
  );

  const mapKey = `${latitude.toFixed(5)}_${longitude.toFixed(5)}`;

  return (
    <View style={[styles.shell, { height }]} collapsable={false}>
      <MapView
        key={mapKey}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
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
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
