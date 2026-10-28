import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { MAP_MARKER_IMAGES } from '../constants/mapMarkerAssets';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { formatMapDistanceKm, haversineDistanceKm } from '../utils/distanceKm';
import { layoutMechanicMarkerForMap } from '../utils/mapMarkerOverlap';
import { statusBarTopInset } from '../utils/screenInsets';
import {
  buildMapRegion,
  mapFitEdgePadding,
  mapMarkerIconSizePx,
  type MapZoomPreset,
} from '../utils/mapZoom';
import { ScaledMapMarkerImage } from './ScaledMapMarkerImage';

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
  liveDistanceKm?: number | null;
  showLiveDistanceBadge?: boolean;
  /** Tighter default zoom for request / job detail screens. */
  zoomPreset?: MapZoomPreset;
  /** Owner active map uses a transparent nav header — badge sits lower and larger. */
  liveDistanceBadgeVariant?: 'default' | 'owner';
};

export function HelpRequestMap({
  request,
  mechanic,
  height = 220,
  fill = false,
  showMyLocation = true,
  requestPinLabel = 'Customer',
  mechanicPinLabel = 'Mechanic',
  showRouteLine = true,
  liveDistanceKm,
  showLiveDistanceBadge = true,
  zoomPreset = 'default',
  liveDistanceBadgeVariant = 'default',
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
    () => buildMapRegion(zoomPreset, request, requestCoord, mechanicMarkerCoord),
    [zoomPreset, request, requestCoord, mechanicMarkerCoord],
  );

  const [latitudeDelta, setLatitudeDelta] = useState(fallbackRegion.latitudeDelta);
  const [tracksMarkers, setTracksMarkers] = useState(true);

  const iconSize = useMemo(() => mapMarkerIconSizePx(latitudeDelta), [latitudeDelta]);

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
    setLatitudeDelta(fallbackRegion.latitudeDelta);
    scheduleTrackReset();
  }, [fallbackRegion.latitudeDelta, scheduleTrackReset]);

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

  const onRegionChangeComplete = useCallback(
    (region: Region) => {
      setLatitudeDelta(region.latitudeDelta);
      scheduleTrackReset();
    },
    [scheduleTrackReset],
  );

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const basePadding = mapFitEdgePadding(zoomPreset);
    const edgePadding =
      ownerBadge && fill
        ? { ...basePadding, top: Math.max(basePadding.top, badgeTop + 36) }
        : basePadding;

    if (mechanicCoord && mechanicMarkerCoord) {
      map.fitToCoordinates([requestCoord, mechanicMarkerCoord], {
        edgePadding,
        animated: true,
      });
      return;
    }

    map.animateToRegion(fallbackRegion, 280);
  }, [
    requestCoord,
    mechanicCoord,
    mechanicMarkerCoord,
    fallbackRegion,
    zoomPreset,
    ownerBadge,
    fill,
    badgeTop,
  ]);

  const showRoute =
    showRouteLine &&
    mechanicCoord &&
    !overlapLayout?.pinsOverlapped &&
    !overlapLayout?.showOverlapConnector;

  const lineCoords = showRoute ? [requestCoord, mechanicCoord!] : [];

  const connectorCoords =
    overlapLayout?.showOverlapConnector && mechanicMarkerCoord
      ? [requestCoord, mechanicMarkerCoord]
      : [];

  return (
    <View style={[styles.wrap, fill ? styles.fill : { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={fallbackRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={showMyLocation}
        showsMyLocationButton={showMyLocation}
        mapType="standard"
        rotateEnabled={false}
      >
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
