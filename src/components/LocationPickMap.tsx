import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export type PickLocation = {
  latitude: number;
  longitude: number;
};

type Props = {
  center: PickLocation | null;
  onCenterChange: (center: PickLocation) => void;
  onUseMyLocation?: () => void;
  locating?: boolean;
  height?: number;
};

export function LocationPickMap({
  center,
  onCenterChange,
  onUseMyLocation,
  locating,
  height = 220,
}: Props) {
  const region = useMemo(() => {
    if (!center) {
      return {
        latitude: 14.5995,
        longitude: 120.9842,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    };
  }, [center]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        region={center ? region : undefined}
        showsUserLocation
        showsMyLocationButton
        mapType="standard"
        onPress={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          onCenterChange({ latitude, longitude });
        }}
      >
        {center ? (
          <Marker
            coordinate={center}
            draggable
            pinColor="#dc2626"
            title="Your help location"
            description="Drag to adjust"
            onDragEnd={(event) => {
              const { latitude, longitude } = event.nativeEvent.coordinate;
              onCenterChange({ latitude, longitude });
            }}
          />
        ) : null}
      </MapView>
      {onUseMyLocation ? (
        <Pressable style={styles.gpsBtn} onPress={onUseMyLocation} disabled={locating}>
          <Text style={styles.gpsBtnText}>{locating ? 'Locating…' : 'Pin my location'}</Text>
        </Pressable>
      ) : null}
      {!center ? (
        <View style={styles.hintOverlay} pointerEvents="none">
          <Text style={styles.hintText}>
            Tap the map, use Pin my location, or the Google Maps location button
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#cbd5e1' },
  gpsBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  gpsBtnText: { fontWeight: '700', color: '#0284c7', fontSize: 13 },
  hintOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.55)',
  },
  hintText: { color: '#475569', fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
});
