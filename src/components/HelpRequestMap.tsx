import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export type MapPoint = {
  latitude: number;
  longitude: number;
  title?: string;
};

type Props = {
  request: MapPoint;
  mechanic?: MapPoint | null;
  height?: number;
  /** Blue dot + Google/Apple “my location” control on the map. */
  showMyLocation?: boolean;
};

export function HelpRequestMap({
  request,
  mechanic,
  height = 220,
  showMyLocation = true,
}: Props) {
  const region = useMemo(() => {
    const points = [request, mechanic].filter(Boolean) as MapPoint[];
    if (points.length === 0) {
      return {
        latitude: request.latitude,
        longitude: request.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }

    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const pad = 0.012;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, maxLat - minLat + pad),
      longitudeDelta: Math.max(0.02, maxLng - minLng + pad),
    };
  }, [request, mechanic]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        region={region}
        showsUserLocation={showMyLocation}
        showsMyLocationButton={showMyLocation}
        mapType="standard"
      >
        <Marker
          coordinate={request}
          title={request.title ?? 'Your help location'}
          description="Where you need assistance"
          pinColor="#dc2626"
        />
        {mechanic && (
          <Marker coordinate={mechanic} title={mechanic.title ?? 'Mechanic'} pinColor="#0284c7" />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
});
