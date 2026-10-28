import { GoogleMaps } from 'expo-maps';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MapDirectoryPin } from '../types/mapPins';
import { zoomForRadiusKm } from '../utils/mapZoom';

export type SearchCenter = {
  latitude: number;
  longitude: number;
};

type Props = {
  center: SearchCenter | null;
  radiusKm: number;
  pins?: MapDirectoryPin[];
  onCenterChange: (center: SearchCenter) => void;
  onUseMyLocation?: () => void;
  locating?: boolean;
};

/** Android: Google Maps via expo-maps (no OSM / UrlTile — avoids volunteer tile "access blocked"). */
export function DirectoryRadiusMap({
  center,
  radiusKm,
  pins = [],
  onCenterChange,
  onUseMyLocation,
  locating,
}: Props) {
  const fallbackCenter = { latitude: 14.5995, longitude: 120.9842 };
  const mapCenter = center ?? fallbackCenter;

  const cameraPosition = useMemo(
    () => ({
      coordinates: mapCenter,
      zoom: zoomForRadiusKm(radiusKm),
    }),
    [mapCenter.latitude, mapCenter.longitude, radiusKm],
  );

  const markers = useMemo(() => {
    const list: GoogleMaps.Marker[] = [
      {
        id: 'search-center',
        coordinates: mapCenter,
        title: 'Search here',
        snippet: `${radiusKm} km radius`,
        draggable: true,
      },
    ];

    for (const pin of pins) {
      list.push({
        id: `${pin.markerKeyPrefix ?? 'listing'}-${pin.id}`,
        coordinates: { latitude: pin.latitude, longitude: pin.longitude },
        title: pin.title,
        snippet: pin.snippet,
      });
    }

    return list;
  }, [mapCenter, pins, radiusKm]);

  const circles = useMemo((): GoogleMaps.Circle[] => {
    if (!center) return [];

    return [
      {
        id: 'search-radius',
        center,
        radius: radiusKm * 1000,
        color: 'rgba(2, 132, 199, 0.18)',
        lineColor: 'rgba(2, 132, 199, 0.85)',
        lineWidth: 2,
      },
    ];
  }, [center, radiusKm]);

  return (
    <View style={styles.wrap}>
      <GoogleMaps.View
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        markers={markers}
        circles={circles}
        properties={{
          isMyLocationEnabled: true,
        }}
        uiSettings={{
          myLocationButtonEnabled: true,
          zoomControlsEnabled: false,
        }}
        onMapClick={({ coordinates }) => {
          if (coordinates.latitude == null || coordinates.longitude == null) return;
          onCenterChange({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          });
        }}
      />

      <View style={styles.overlay}>
        <Text style={styles.hint}>Tap map to move search point</Text>
        {onUseMyLocation ? (
          <Pressable style={styles.locBtn} onPress={onUseMyLocation} disabled={locating}>
            <Text style={styles.locBtnText}>{locating ? 'Locating…' : 'My location'}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.attribution}>Google Maps</Text>
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
