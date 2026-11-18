import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { colors, radii, spacing, touch } from '../theme/tokens';
import { fetchDrivingRoute, type MapCoord } from '../utils/drivingDirections';
import {
  isImplausibleNavigationDistance,
  navigationDistanceKm,
  planNavigationCamera,
} from '../utils/mapNavigationCamera';
import { resolveMechanicToCustomerDistanceKm } from '../utils/distanceKm';
import { HelpRequestMap } from './HelpRequestMap';

export type DirectionsDestination = {
  latitude: number;
  longitude: number;
  label?: string;
};

type Props = {
  visible: boolean;
  destination: DirectionsDestination | null;
  onClose: () => void;
};

export function InAppDirectionsModal({ visible, destination, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [navigationPulse, setNavigationPulse] = useState(0);
  const [route, setRoute] = useState<MapCoord[]>([]);

  const { coords } = useDeviceLocation(visible, { live: visible });

  const userPoint = useMemo(
    () =>
      coords
        ? { latitude: coords.latitude, longitude: coords.longitude, title: 'You' }
        : null,
    [coords?.latitude, coords?.longitude],
  );

  const distanceKm = useMemo(() => {
    if (!destination) return null;
    return resolveMechanicToCustomerDistanceKm(
      { latitude: destination.latitude, longitude: destination.longitude },
      coords,
    );
  }, [destination, coords]);

  const userToDestKm = useMemo(() => {
    if (!destination || !userPoint) {
      return null;
    }
    return navigationDistanceKm(userPoint, destination);
  }, [destination, userPoint]);

  const gpsMismatch = isImplausibleNavigationDistance(userToDestKm);

  useEffect(() => {
    if (!visible || !destination || !userPoint || gpsMismatch) {
      setRoute([]);
      return;
    }
    let cancelled = false;
    void fetchDrivingRoute(userPoint, destination).then((path) => {
      if (!cancelled) {
        setRoute(path ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    visible,
    gpsMismatch,
    destination?.latitude,
    destination?.longitude,
    userPoint?.latitude,
    userPoint?.longitude,
  ]);

  useEffect(() => {
    if (visible && destination) {
      setNavigationPulse((n) => n + 1);
    }
  }, [visible, destination?.latitude, destination?.longitude]);

  if (!destination) {
    return null;
  }

  const title = destination.label?.trim() || 'Destination';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Navigate in RydAid</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {title}
              {distanceKm != null ? ` · ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm} km`}` : ''}
            </Text>
          </View>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close directions"
          >
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.mapArea}>
          <HelpRequestMap
            request={{
              latitude: destination.latitude,
              longitude: destination.longitude,
              title,
            }}
            mechanic={userPoint}
            requestPinLabel="Destination"
            mechanicPinLabel="You"
            fill
            showMyLocation={false}
            showRouteLine={!!userPoint}
            drivingRouteCoords={route}
            navigationRefitPulse={navigationPulse}
            liveDistanceKm={distanceKm}
            showLiveDistanceBadge={distanceKm != null}
            zoomPreset="live"
          />
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Text style={styles.hint}>
            {gpsMismatch
              ? 'Map is zoomed on the destination. Your GPS looks far away — set device location closer to preview a driving route.'
              : route.length > 1
                ? 'Follow the blue route. Your position updates as you move.'
                : userPoint
                  ? 'Head toward the pin — enable Directions API for a road route.'
                  : 'Turn on location to see your position on the map.'}
          </Text>
          <Pressable
            style={styles.refitBtn}
            onPress={() => setNavigationPulse((n) => n + 1)}
            accessibilityRole="button"
          >
            <Text style={styles.refitBtnText}>Recenter map</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { marginTop: 2, fontSize: 13, color: colors.muted, fontWeight: '600' },
  closeBtn: {
    minHeight: touch.min,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtnText: { fontWeight: '700', color: colors.primary },
  mapArea: { flex: 1, backgroundColor: '#cbd5e1' },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted, fontWeight: '600' },
  refitBtn: {
    minHeight: touch.control,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refitBtnText: { color: colors.onPrimary, fontWeight: '800', fontSize: 16 },
});