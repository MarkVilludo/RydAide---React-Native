import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { MechanicResult } from '../api/mechanics';
import { regionForRadiusKm } from '../utils/mapRegion';

export type SearchCenter = {
  latitude: number;
  longitude: number;
};

type Props = {
  center: SearchCenter | null;
  radiusKm: number;
  mechanics?: MechanicResult[];
  onCenterChange: (center: SearchCenter) => void;
  onUseMyLocation?: () => void;
  locating?: boolean;
};

/** iOS: Apple Maps via react-native-maps (no third-party tile URLs). */
export function DirectoryRadiusMap({
  center,
  radiusKm,
  mechanics = [],
  onCenterChange,
  onUseMyLocation,
  locating,
}: Props) {
  const mapRef = useRef<MapView>(null);

  const region = useMemo(() => {
    if (!center) {
      return {
        latitude: 14.5995,
        longitude: 120.9842,
        latitudeDelta: 0.35,
        longitudeDelta: 0.35,
      };
    }

    return regionForRadiusKm(center.latitude, center.longitude, radiusKm);
  }, [center, radiusKm]);

  useEffect(() => {
    if (!center || !mapRef.current) return;
    mapRef.current.animateToRegion(regionForRadiusKm(center.latitude, center.longitude, radiusKm), 280);
  }, [center, radiusKm]);

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType="standard"
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          onCenterChange({ latitude, longitude });
        }}
      >
        {center ? (
          <>
            <Circle
              center={center}
              radius={radiusKm * 1000}
              strokeColor="rgba(2, 132, 199, 0.85)"
              fillColor="rgba(2, 132, 199, 0.18)"
              strokeWidth={2}
            />
            <Marker
              coordinate={center}
              draggable
              pinColor="#0284c7"
              title="Search here"
              description={`${radiusKm} km radius`}
              onDragEnd={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                onCenterChange({ latitude, longitude });
              }}
            />
          </>
        ) : null}
        {mechanics.map((m) => {
          if (m.latitude == null || m.longitude == null) return null;

          return (
            <Marker
              key={m.id}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              title={m.business_name}
              description={
                m.distance_km != null ? `${m.distance_km} km · ★ ${m.rating_average}` : undefined
              }
              pinColor="#16a34a"
            />
          );
        })}
      </MapView>

      <View style={styles.overlay}>
        <Text style={styles.hint}>Tap map or drag pin to set search location</Text>
        {onUseMyLocation ? (
          <Pressable style={styles.locBtn} onPress={onUseMyLocation} disabled={locating}>
            <Text style={styles.locBtnText}>{locating ? 'Locating…' : 'My location'}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.attribution}>Apple Maps</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#e2e8f0',
  },
  overlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hint: {
    flex: 1,
    fontSize: 11,
    color: '#334155',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  locBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    fontSize: 9,
    color: '#475569',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
