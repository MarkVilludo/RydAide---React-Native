import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type EdgePadding, type Region } from 'react-native-maps';
import type { HelpRequest } from '../api/helpRequests';
import { colors as C } from '../theme/colors';
import { androidMapsProvider } from '../utils/mapsProvider';
import { DrawerIcon } from './DrawerIcons';

export type LatLng = { latitude: number; longitude: number };

export type MechanicDashboardMapHandle = {
  /** Animate back to the service pin (or GPS when there's no pin). */
  recenter: () => void;
  /** Fit the pin and every request marker in view. */
  fitAll: () => void;
  /** Pan to one request without changing zoom much. */
  focusRequest: (request: HelpRequest) => void;
};

type Props = {
  /** Service pin, else device GPS. Map starts here. */
  center: LatLng | null;
  showUserLocation: boolean;
  serviceRadiusKm: number | null;
  requests: HelpRequest[];
  activeJob: HelpRequest | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** Space covered by overlays, so markers / fit stay in the visible part. */
  padding: EdgePadding;
  nowMs: number;
};

const NEW_WINDOW_MS = 3 * 60 * 1000;
const MANILA: LatLng = { latitude: 14.5995, longitude: 120.9842 };

export function isEmergencyRequest(r: Pick<HelpRequest, 'request_type'>): boolean {
  return String(r.request_type).toUpperCase() === 'EMERGENCY';
}

export function isNewRequest(r: Pick<HelpRequest, 'created_at' | 'search_started_at'>, nowMs: number): boolean {
  const iso = r.search_started_at ?? r.created_at;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && nowMs - t < NEW_WINDOW_MS;
}

function coordOf(r: HelpRequest): LatLng | null {
  const latitude = Number(r.latitude);
  const longitude = Number(r.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function deltaForRadius(km: number | null): number {
  // ~111 km per degree; show the radius with a little margin.
  const r = km != null && km > 0 ? Math.min(km, 50) : 3;
  return Math.max(0.02, (r * 2.4) / 111);
}

/**
 * Custom-view marker that only tracks view changes briefly after its look changes,
 * so the map doesn't re-rasterise every marker on every render.
 */
const RequestMarker = memo(function RequestMarker({
  request,
  coordinate,
  selected,
  isNew,
  kind,
  onPress,
}: {
  request: HelpRequest;
  coordinate: LatLng;
  selected: boolean;
  isNew: boolean;
  kind: 'emergency' | 'service' | 'active';
  onPress: (id: number) => void;
}) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), Platform.OS === 'android' ? 600 : 300);
    return () => clearTimeout(t);
  }, [selected, isNew, kind]);

  const color = kind === 'emergency' ? C.danger : kind === 'active' ? C.active : C.primary;
  const label = kind === 'emergency' ? 'Emergency' : kind === 'active' ? 'Your job' : 'Service';
  const size = selected ? 46 : 36;

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress(request.id);
      }}
      zIndex={selected ? 30 : kind === 'emergency' ? 20 : 10}
      accessibilityLabel={`${label} request${isNew ? ', new' : ''}`}
    >
      <View style={styles.markerBox} collapsable={false}>
        {isNew || selected ? (
          <View
            style={[
              styles.halo,
              {
                width: size + 18,
                height: size + 18,
                borderRadius: (size + 18) / 2,
                backgroundColor: color,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.markerDot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
            },
            selected && styles.markerSelected,
          ]}
        >
          {kind === 'emergency' ? (
            <Text style={[styles.markerBang, selected && styles.markerBangLg]}>!</Text>
          ) : (
            <DrawerIcon name="wrench" size={selected ? 22 : 18} color={C.onPrimary} />
          )}
        </View>
        {isNew ? (
          <View style={[styles.newTag, { borderColor: color }]}>
            <Text style={[styles.newTagText, { color }]}>NEW</Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
});

const PinMarker = memo(function PinMarker({ coordinate }: { coordinate: LatLng }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
      zIndex={5}
      title="Your service pin"
      description="Requests are matched around this spot"
    >
      <View style={styles.pinWrap} collapsable={false}>
        <View style={styles.pinHead}>
          <DrawerIcon name="toolbox" size={16} color={C.onPrimary} />
        </View>
        <View style={styles.pinTail} />
      </View>
    </Marker>
  );
});

export const MechanicDashboardMap = memo(
  forwardRef<MechanicDashboardMapHandle, Props>(function MechanicDashboardMap(
    { center, showUserLocation, serviceRadiusKm, requests, activeJob, selectedId, onSelect, padding, nowMs },
    ref,
  ) {
    const mapRef = useRef<MapView>(null);
    const delta = deltaForRadius(serviceRadiusKm);
    // Start once; never follow GPS drift through props (recenter is explicit).
    const [initialRegion] = useState<Region>(() => ({
      ...(center ?? MANILA),
      latitudeDelta: delta,
      longitudeDelta: delta,
    }));

    const markers = useMemo(() => {
      const list: Array<{
        request: HelpRequest;
        coordinate: LatLng;
        kind: 'emergency' | 'service' | 'active';
      }> = [];
      if (activeJob) {
        const c = coordOf(activeJob);
        if (c) list.push({ request: activeJob, coordinate: c, kind: 'active' });
      }
      for (const r of requests) {
        if (activeJob && r.id === activeJob.id) continue;
        const c = coordOf(r);
        if (c)
          list.push({
            request: r,
            coordinate: c,
            kind: isEmergencyRequest(r) ? 'emergency' : 'service',
          });
      }
      return list;
    }, [requests, activeJob]);

    const centerRef = useRef(center);
    centerRef.current = center;
    const markersRef = useRef(markers);
    markersRef.current = markers;
    const paddingRef = useRef(padding);
    paddingRef.current = padding;

    const recenter = useCallback(() => {
      const c = centerRef.current;
      if (!c) return;
      mapRef.current?.animateToRegion({ ...c, latitudeDelta: delta, longitudeDelta: delta }, 350);
    }, [delta]);

    const fitAll = useCallback(() => {
      const pts = markersRef.current.map((m) => m.coordinate);
      const c = centerRef.current;
      if (c) pts.push(c);
      if (pts.length === 0) return;
      if (pts.length === 1) {
        mapRef.current?.animateToRegion({ ...pts[0]!, latitudeDelta: delta, longitudeDelta: delta }, 350);
        return;
      }
      const p = paddingRef.current;
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: {
          top: p.top + 48,
          right: p.right + 48,
          bottom: p.bottom + 48,
          left: p.left + 48,
        },
        animated: true,
      });
    }, [delta]);

    const focusRequest = useCallback((r: HelpRequest) => {
      const c = coordOf(r);
      if (c) mapRef.current?.animateCamera({ center: c }, { duration: 300 });
    }, []);

    useImperativeHandle(ref, () => ({ recenter, fitAll, focusRequest }), [recenter, fitAll, focusRequest]);

    // Centre on the pin once it first becomes known (the map may mount before location loads).
    const hadCenter = useRef(center != null);
    useEffect(() => {
      if (!hadCenter.current && center) {
        hadCenter.current = true;
        recenter();
      }
    }, [center, recenter]);

    // Fit when the set of requests changes (new ones arrive / some disappear) — not on every poll.
    const idsKey = markers
      .map((m) => m.request.id)
      .sort((a, b) => a - b)
      .join(',');
    const seenIds = useRef('');
    useEffect(() => {
      if (idsKey === seenIds.current) return;
      seenIds.current = idsKey;
      if (idsKey) {
        const t = setTimeout(fitAll, 250);
        return () => clearTimeout(t);
      }
    }, [idsKey, fitAll]);

    const onMarkerPress = useCallback((id: number) => onSelect(id), [onSelect]);

    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={androidMapsProvider()}
        initialRegion={initialRegion}
        mapPadding={padding}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
        onPress={() => onSelect(null)}
      >
        {center && serviceRadiusKm != null ? (
          <Circle
            center={center}
            radius={serviceRadiusKm * 1000}
            strokeColor="rgba(2,132,199,0.45)"
            fillColor="rgba(2,132,199,0.07)"
            strokeWidth={1.5}
          />
        ) : null}
        {center ? <PinMarker coordinate={center} /> : null}
        {markers.map((m) => (
          <RequestMarker
            key={m.request.id}
            request={m.request}
            coordinate={m.coordinate}
            kind={m.kind}
            selected={selectedId === m.request.id}
            isNew={m.kind !== 'active' && isNewRequest(m.request, nowMs)}
            onPress={onMarkerPress}
          />
        ))}
      </MapView>
    );
  }),
);

const styles = StyleSheet.create({
  markerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 78,
  },
  halo: { position: 'absolute', opacity: 0.22 },
  markerDot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  markerSelected: { borderWidth: 4 },
  markerBang: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  markerBangLg: { fontSize: 24, lineHeight: 28 },
  newTag: {
    position: 'absolute',
    bottom: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
  },
  newTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  pinWrap: { alignItems: 'center', width: 40, height: 46 },
  pinHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.primaryInk,
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.primaryInk,
    marginTop: -2,
  },
});
