import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { MAP_MARKER_IMAGES } from '../constants/mapMarkerAssets';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { formatMapDistanceKm, haversineDistanceKm } from '../utils/distanceKm';
import { layoutMechanicMarkerForMap } from '../utils/mapMarkerOverlap';
import { androidMapsProvider, hasGoogleMapsApiKey } from '../utils/mapsProvider';
import { statusBarTopInset } from '../utils/screenInsets';
import {
  buildMapRegion,
  liveMapFitPadding,
  mapFitEdgePadding,
  mapMarkerIconSizePx,
  type MapZoomPreset,
} from '../utils/mapZoom';
import { MapZoomControls } from './MapZoomControls';
import { ScaledMapMarkerImage } from './ScaledMapMarkerImage';
import type { MapCoord } from '../utils/drivingDirections';
import {
  NAV_MAX_DUAL_FIT_KM,
  navigationDistanceKm,
  planNavigationCamera,
} from '../utils/mapNavigationCamera';

export type MapPoint = {
  latitude: number;
  longitude: number;
  title?: string;
};

type Props = {
  request: MapPoint;
  mechanic?: MapPoint | null;
  height?: number;
  fill?: boolean;
  showMyLocation?: boolean;
  requestPinLabel?: string;
  mechanicPinLabel?: string;
  showRouteLine?: boolean;
  /** Road-following route (in-app navigation). */
  drivingRouteCoords?: MapCoord[] | null;
  /** Bump to re-center the camera on the customer + mechanic pins. */
  navigationRefitPulse?: number;
  liveDistanceKm?: number | null;
  showLiveDistanceBadge?: boolean;
  /** Tighter default zoom for request / job detail screens. */
  zoomPreset?: MapZoomPreset;
  /** Owner active map uses a transparent nav header — badge sits lower and larger. */
  liveDistanceBadgeVariant?: 'default' | 'owner';
  showZoomControls?: boolean;
  zoomControlsBottomInset?: number;
};

const ZOOM_IN_FACTOR = 0.58;
const ZOOM_OUT_FACTOR = 1.55;
const MIN_VIEW_DELTA = 0.0025;
const MAX_VIEW_DELTA = 0.42;

export function HelpRequestMap({
  request,
  mechanic,
  height = 220,
  fill = false,
  showMyLocation = true,
  requestPinLabel = 'Customer',
  mechanicPinLabel = 'Mechanic',
  showRouteLine = true,
  drivingRouteCoords = null,
  navigationRefitPulse = 0,
  liveDistanceKm,
  showLiveDistanceBadge = true,
  zoomPreset = 'default',
  liveDistanceBadgeVariant = 'default',
  showZoomControls,
  zoomControlsBottomInset,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const trackResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markers = useMapMarkers();
  const customerLabel = requestPinLabel ?? markers.customer.label;
  const mechanicLabel = mechanicPinLabel ?? markers.mechanic.label;

  const requestCoord = useMemo(
    () => ({ latitude: request.latitude, longitude: request.longitude }),
    [request.latitude, request.longitude],
  );

  const mechanicCoord = useMemo(
    () =>
      mechanic
        ? { latitude: mechanic.latitude, longitude: mechanic.longitude }
        : null,
    [mechanic?.latitude, mechanic?.longitude],
  );

  const overlapLayout = useMemo(() => {
    if (!mechanicCoord) {
      return null;
    }
    return layoutMechanicMarkerForMap(requestCoord, mechanicCoord);
  }, [requestCoord, mechanicCoord]);

  const mechanicMarkerCoord = overlapLayout?.mechanicDisplay ?? mechanicCoord;

  const fallbackRegion = useMemo(
    () => buildMapRegion(zoomPreset, requestCoord, requestCoord, mechanicMarkerCoord),
    [zoomPreset, requestCoord.latitude, requestCoord.longitude, mechanicMarkerCoord],
  );

  const regionKey = useMemo(() => {
    const m = mechanicMarkerCoord;
    return [
      zoomPreset,
      requestCoord.latitude.toFixed(5),
      requestCoord.longitude.toFixed(5),
      m ? `${m.latitude.toFixed(5)},${m.longitude.toFixed(5)}` : 'solo',
    ].join('|');
  }, [zoomPreset, requestCoord.latitude, requestCoord.longitude, mechanicMarkerCoord]);

  const [latitudeDelta, setLatitudeDelta] = useState(fallbackRegion.latitudeDelta);
  const [tracksMarkers, setTracksMarkers] = useState(true);
  /** User pinched/panned — do not snap the camera back until pins move or preset changes. */
  const userAdjustedViewRef = useRef(false);
  const ignoreUserGestureUntilRef = useRef(0);
  const lastRegionDeltaRef = useRef(fallbackRegion.latitudeDelta);
  const viewRegionRef = useRef<Region>(fallbackRegion);

  const showZoom = showZoomControls ?? (fill || height >= 140);
  const zoomBottom = useMemo(() => {
    if (zoomControlsBottomInset != null) {
      return zoomControlsBottomInset;
    }
    if (fill && zoomPreset === 'live') {
      const h = Dimensions.get('window').height;
      return Math.round(Math.min(168, Math.max(104, h * 0.24)));
    }
    return fill ? 16 : 10;
  }, [zoomControlsBottomInset, fill, zoomPreset]);

  // Detail screens (Request details) use a tighter zoom — keep pins smaller so they don't dominate.
  const iconSize = useMemo(
    () => mapMarkerIconSizePx(latitudeDelta, zoomPreset === 'detail' ? 0.85 : 1),
    [latitudeDelta, zoomPreset],
  );

  const scheduleTrackReset = useCallback(() => {
    if (trackResetTimer.current) {
      clearTimeout(trackResetTimer.current);
    }
    setTracksMarkers(true);
    trackResetTimer.current = setTimeout(() => {
      setTracksMarkers(false);
      trackResetTimer.current = null;
    }, 450);
  }, []);

  useEffect(() => {
    userAdjustedViewRef.current = false;
    setLatitudeDelta(fallbackRegion.latitudeDelta);
    lastRegionDeltaRef.current = fallbackRegion.latitudeDelta;
    viewRegionRef.current = fallbackRegion;
    scheduleTrackReset();
  }, [regionKey, fallbackRegion.latitudeDelta, scheduleTrackReset]);

  useEffect(() => {
    scheduleTrackReset();
  }, [iconSize, scheduleTrackReset]);

  useEffect(
    () => () => {
      if (trackResetTimer.current) {
        clearTimeout(trackResetTimer.current);
      }
    },
    [],
  );

  const adjustZoom = useCallback(
    (factor: number) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }
      const current = viewRegionRef.current;
      const nextDelta = Math.min(
        MAX_VIEW_DELTA,
        Math.max(MIN_VIEW_DELTA, current.latitudeDelta * factor),
      );
      const next: Region = {
        latitude: current.latitude,
        longitude: current.longitude,
        latitudeDelta: nextDelta,
        longitudeDelta: nextDelta,
      };
      userAdjustedViewRef.current = true;
      ignoreUserGestureUntilRef.current = Date.now() + 500;
      lastRegionDeltaRef.current = nextDelta;
      viewRegionRef.current = next;
      setLatitudeDelta(nextDelta);
      map.animateToRegion(next, 220);
      scheduleTrackReset();
    },
    [scheduleTrackReset],
  );

  const zoomIn = useCallback(() => adjustZoom(ZOOM_IN_FACTOR), [adjustZoom]);
  const zoomOut = useCallback(() => adjustZoom(ZOOM_OUT_FACTOR), [adjustZoom]);

  const onRegionChangeComplete = useCallback(
    (region: Region) => {
      viewRegionRef.current = region;
      setLatitudeDelta(region.latitudeDelta);
      scheduleTrackReset();
      if (Date.now() < ignoreUserGestureUntilRef.current) {
        lastRegionDeltaRef.current = region.latitudeDelta;
        return;
      }
      const prev = lastRegionDeltaRef.current;
      const zoomChanged = Math.abs(region.latitudeDelta - prev) / Math.max(prev, 0.0001) > 0.04;
      lastRegionDeltaRef.current = region.latitudeDelta;
      if (zoomChanged) {
        userAdjustedViewRef.current = true;
      }
    },
    [scheduleTrackReset],
  );

  const onPanDrag = useCallback(() => {
    if (Date.now() >= ignoreUserGestureUntilRef.current) {
      userAdjustedViewRef.current = true;
    }
  }, []);

  const computedDistanceKm = useMemo(() => {
    if (liveDistanceKm != null && Number.isFinite(liveDistanceKm)) {
      return liveDistanceKm;
    }
    if (!mechanicCoord) {
      return null;
    }
    return haversineDistanceKm(
      mechanicCoord.latitude,
      mechanicCoord.longitude,
      requestCoord.latitude,
      requestCoord.longitude,
    );
  }, [liveDistanceKm, mechanicCoord, requestCoord.latitude, requestCoord.longitude]);

  const distanceBadge = formatMapDistanceKm(computedDistanceKm);
  const ownerBadge = liveDistanceBadgeVariant === 'owner';
  const badgeTop = ownerBadge ? statusBarTopInset() + 48 : 10;

  const lastFitKey = useRef<string | null>(null);
  const lastSoloFitKey = useRef<string | null>(null);
  const lastNavigationPulse = useRef(0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const screenH = Dimensions.get('window').height;
    const basePadding =
      zoomPreset === 'live' && fill ? liveMapFitPadding(screenH) : mapFitEdgePadding(zoomPreset);
    const edgePadding =
      ownerBadge && fill
        ? {
            ...basePadding,
            top: Math.max(basePadding.top, badgeTop + 36),
          }
        : basePadding;

    const forceNav =
      navigationRefitPulse > 0 && navigationRefitPulse !== lastNavigationPulse.current;
    if (forceNav) {
      lastNavigationPulse.current = navigationRefitPulse;
      userAdjustedViewRef.current = false;
      lastFitKey.current = null;
    }

    const applyNavigationCamera = (animated: boolean) => {
      const plan = planNavigationCamera(requestCoord, mechanicMarkerCoord, drivingRouteCoords);
      userAdjustedViewRef.current = false;
      ignoreUserGestureUntilRef.current = Date.now() + 900;
      if (plan.kind === 'fit') {
        map.fitToCoordinates(plan.coords, { edgePadding, animated });
      } else {
        map.animateToRegion(plan.region, animated ? 450 : 280);
      }
    };

    if (mechanicCoord && mechanicMarkerCoord) {
      // Avoid re-animating the camera on every GPS tick — only when the pair moves enough.
      const fitKey = [
        requestCoord.latitude.toFixed(4),
        requestCoord.longitude.toFixed(4),
        mechanicMarkerCoord.latitude.toFixed(4),
        mechanicMarkerCoord.longitude.toFixed(4),
        zoomPreset,
      ].join('|');
      const pinDistanceKm = navigationDistanceKm(mechanicMarkerCoord, requestCoord);
      const farApart = pinDistanceKm > NAV_MAX_DUAL_FIT_KM;

      if (forceNav) {
        applyNavigationCamera(true);
        lastFitKey.current = fitKey;
        return;
      }

      if (fitKey === lastFitKey.current && !forceNav) {
        return;
      }
      if (userAdjustedViewRef.current && zoomPreset !== 'live' && !forceNav) {
        lastFitKey.current = fitKey;
        return;
      }

      if (farApart) {
        const firstFit = lastFitKey.current == null;
        applyNavigationCamera(firstFit || zoomPreset === 'live');
        lastFitKey.current = fitKey;
        return;
      }

      const shouldAnimate = lastFitKey.current == null || zoomPreset !== 'live' || forceNav;
      lastFitKey.current = fitKey;
      userAdjustedViewRef.current = false;
      ignoreUserGestureUntilRef.current = Date.now() + 900;
      map.fitToCoordinates([requestCoord, mechanicMarkerCoord], {
        edgePadding,
        animated: shouldAnimate,
      });
      return;
    }

    lastFitKey.current = null;
    if (lastSoloFitKey.current === regionKey) {
      return;
    }
    if (userAdjustedViewRef.current) {
      lastSoloFitKey.current = regionKey;
      return;
    }
    lastSoloFitKey.current = regionKey;
    ignoreUserGestureUntilRef.current = Date.now() + 600;
    map.animateToRegion(fallbackRegion, 280);
  }, [
    regionKey,
    requestCoord.latitude,
    requestCoord.longitude,
    mechanicCoord,
    mechanicMarkerCoord,
    fallbackRegion.latitude,
    fallbackRegion.longitude,
    fallbackRegion.latitudeDelta,
    fallbackRegion.longitudeDelta,
    zoomPreset,
    ownerBadge,
    fill,
    badgeTop,
    navigationRefitPulse,
    drivingRouteCoords,
  ]);

  const hasDrivingRoute = (drivingRouteCoords?.length ?? 0) > 1;

  const pinDistanceKm =
    mechanicCoord != null
      ? navigationDistanceKm(mechanicCoord, requestCoord)
      : null;
  const pinsTooFarForLine = pinDistanceKm != null && pinDistanceKm > NAV_MAX_DUAL_FIT_KM;

  const showRoute =
    showRouteLine &&
    !hasDrivingRoute &&
    !pinsTooFarForLine &&
    mechanicCoord &&
    !overlapLayout?.pinsOverlapped &&
    !overlapLayout?.showOverlapConnector;

  const lineCoords = showRoute ? [requestCoord, mechanicCoord!] : [];

  const connectorCoords =
    overlapLayout?.showOverlapConnector && mechanicMarkerCoord
      ? [requestCoord, mechanicMarkerCoord]
      : [];

  // Android release builds without a Maps SDK key hard-crash when MapView mounts.
  if (Platform.OS === 'android' && !hasGoogleMapsApiKey()) {
    return (
      <View style={[styles.wrap, fill ? styles.fill : { height }, styles.missingKey]}>
        <Text style={styles.missingKeyTitle}>Map unavailable</Text>
        <Text style={styles.missingKeyBody}>
          This build is missing the Google Maps API key. Your help request still works — rebuild with
          EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to show the map.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, fill ? styles.fill : { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={androidMapsProvider()}
        initialRegion={fallbackRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        onPanDrag={onPanDrag}
        showsUserLocation={showMyLocation}
        showsMyLocationButton={showMyLocation}
        mapType="standard"
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled
        zoomEnabled
        zoomTapEnabled
        zoomControlEnabled={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
      >
        {hasDrivingRoute ? (
          <Polyline
            coordinates={drivingRouteCoords!}
            strokeColor="#0284c7"
            strokeWidth={5}
          />
        ) : null}

        {lineCoords.length === 2 ? (
          <Polyline
            coordinates={lineCoords}
            strokeColor="#475569"
            strokeWidth={3}
            lineDashPattern={[10, 8]}
          />
        ) : null}

        {connectorCoords.length === 2 ? (
          <Polyline
            coordinates={connectorCoords}
            strokeColor="#94a3b8"
            strokeWidth={2}
            lineDashPattern={[4, 6]}
          />
        ) : null}

        <Marker
          coordinate={requestCoord}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={tracksMarkers}
          title={request.title ?? customerLabel}
          description="Help location"
        >
          <ScaledMapMarkerImage source={MAP_MARKER_IMAGES.customer} size={iconSize} />
        </Marker>

        {mechanicCoord && mechanicMarkerCoord ? (
          <Marker
            coordinate={mechanicMarkerCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksMarkers}
            title={mechanic?.title ?? mechanicLabel}
            description={
              overlapLayout?.pinsOverlapped
                ? 'At the help location (icon offset for visibility)'
                : 'Mechanic position'
            }
          >
            <ScaledMapMarkerImage source={MAP_MARKER_IMAGES.mechanic} size={iconSize} />
          </Marker>
        ) : null}
      </MapView>

      {showZoom ? (
        <MapZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} bottomInset={zoomBottom} />
      ) : null}

      {showLiveDistanceBadge && distanceBadge && mechanicCoord ? (
        <View
          style={[
            styles.distanceBadge,
            ownerBadge && styles.distanceBadgeOwner,
            { top: badgeTop },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.distanceValue, ownerBadge && styles.distanceValueOwner]}>
            {distanceBadge}
          </Text>
          <Text style={[styles.distanceApart, ownerBadge && styles.distanceApartOwner]}>
            {overlapLayout?.pinsOverlapped ? 'same area · live' : 'apart · live'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  fill: { flex: 1, minHeight: 120, borderRadius: 0, borderWidth: 0 },
  missingKey: {
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  missingKeyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  missingKeyBody: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  distanceBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  distanceBadgeOwner: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0284c7',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  distanceValue: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  distanceValueOwner: { fontSize: 18, color: '#0369a1' },
  distanceApart: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  distanceApartOwner: { fontSize: 12, fontWeight: '700', color: '#475569' },
});
