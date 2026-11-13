import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { androidMapsProvider, hasGoogleMapsApiKey } from '../utils/mapsProvider';

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
  /** Bump when the map should animate to `center` (GPS, profile load)—not on every pin drag. */
  recenterKey?: number;
  /**
   * map-center: pinch/zoom and pan the map; fixed pin in the middle (best for fine placement).
   * marker: draggable marker on the map.
   */
  pickMode?: 'map-center' | 'marker';
  /** Fires once the native map is ready (useful for load timing). */
  onMapReady?: () => void;
};

const DEFAULT_CENTER = { latitude: 14.5995, longitude: 120.9842 };

function regionFor(
  center: PickLocation,
  latitudeDelta = 0.006,
  longitudeDelta = 0.006,
): Region {
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}

function LocationPickMapInner({
  center,
  onCenterChange,
  onUseMyLocation,
  locating,
  height = 220,
  recenterKey = 0,
  pickMode = 'map-center',
  onMapReady,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRegionEmit = useRef(false);
  const centerRef = useRef(center);
  const onCenterChangeRef = useRef(onCenterChange);

  useEffect(() => {
    centerRef.current = center;
    onCenterChangeRef.current = onCenterChange;
  });

  const initialRegion = useMemo(() => {
    if (center) {
      return regionFor(center, 0.008, 0.008);
    }
    return regionFor(DEFAULT_CENTER, 0.04, 0.04);
  }, []);

  const emitCenter = (location: PickLocation) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onCenterChangeRef.current(location);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Animate only when the parent bumps recenterKey. Depending on center here re-animated (and reset
  // the zoom) after every pan, because each pan updates center in the parent.
  useEffect(() => {
    const target = centerRef.current;
    if (!target || recenterKey <= 0) {
      return;
    }
    skipNextRegionEmit.current = true;
    mapRef.current?.animateToRegion(regionFor(target, 0.006, 0.006), 450);
    const t = setTimeout(() => {
      skipNextRegionEmit.current = false;
    }, 500);
    return () => clearTimeout(t);
  }, [recenterKey]);

  const onRegionChangeComplete = (region: Region) => {
    if (pickMode !== 'map-center' || skipNextRegionEmit.current) {
      return;
    }
    emitCenter({ latitude: region.latitude, longitude: region.longitude });
  };

  if (Platform.OS === 'android' && !hasGoogleMapsApiKey()) {
    return (
      <View style={[styles.wrap, styles.missingKey, { height }]}>
        <Text style={styles.missingKeyTitle}>Map unavailable</Text>
        <Text style={styles.missingKeyBody}>
          Rebuild with EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to pick on the map. You can still use My
          location below.
        </Text>
        {onUseMyLocation ? (
          <Pressable style={styles.locBtn} onPress={onUseMyLocation} disabled={locating}>
            <Text style={styles.locBtnText}>{locating ? 'Locating…' : 'Use my location'}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={androidMapsProvider()}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        mapType="standard"
        scrollEnabled
        zoomEnabled
        zoomTapEnabled
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={onRegionChangeComplete}
        onMapReady={onMapReady}
        onPress={
          pickMode === 'marker'
            ? (event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                emitCenter({ latitude, longitude });
              }
            : undefined
        }
      >
        {pickMode === 'marker' && center ? (
          <Marker
            coordinate={center}
            draggable
            pinColor="#dc2626"
            title="Your location"
            description="Drag to adjust"
            onDragEnd={(event) => {
              const { latitude, longitude } = event.nativeEvent.coordinate;
              onCenterChange({ latitude, longitude });
            }}
          />
        ) : null}
      </MapView>

      {pickMode === 'map-center' ? (
        <View pointerEvents="none" style={styles.centerPinWrap}>
          <View style={styles.centerPinAnchor}>
            <View style={styles.centerPinDot} />
            <View style={styles.centerPinTip} />
          </View>
        </View>
      ) : null}

      {onUseMyLocation ? (
        <Pressable style={styles.gpsBtn} onPress={onUseMyLocation} disabled={locating}>
          <Text style={styles.gpsBtnText}>{locating ? 'Locating…' : 'Pin my location'}</Text>
        </Pressable>
      ) : null}

      <View style={styles.zoomHint} pointerEvents="none">
        <Text style={styles.zoomHintText}>
          {pickMode === 'map-center'
            ? 'Pinch to zoom · drag the map to place the pin'
            : 'Pinch to zoom · tap map or drag the marker'}
        </Text>
      </View>

      {!center ? (
        <View style={styles.hintOverlay} pointerEvents="none">
          <Text style={styles.hintText}>
            Tap Pin my location, use the map location button, or wait for GPS
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Memoized so typing in sibling inputs doesn't re-render the native map. */
export const LocationPickMap = memo(LocationPickMapInner);

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#cbd5e1' },
  missingKey: {
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  missingKeyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  missingKeyBody: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  locBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  locBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
    zIndex: 2,
  },
  gpsBtnText: { fontWeight: '700', color: '#0284c7', fontSize: 13 },
  zoomHint: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    alignItems: 'center',
    zIndex: 2,
  },
  zoomHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center',
  },
  hintOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.55)',
  },
  hintText: { color: '#475569', fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
  centerPinWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinAnchor: {
    alignItems: 'center',
    transform: [{ translateY: -16 }],
  },
  centerPinDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  centerPinTip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#dc2626',
  },
});
