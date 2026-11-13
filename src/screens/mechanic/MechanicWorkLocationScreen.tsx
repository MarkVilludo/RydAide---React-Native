import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import { fetchMyMechanicProfile, updateMechanicProfileLocation } from '../../api/mechanicProfile';
import { showAppToast } from '../../components/AppToast';
import { LocationPickMap } from '../../components/LocationPickMap';
import {
  servicePinManualSaveHint,
  servicePinTooFarAlertBody,
  SERVICE_PIN_GPS_REQUIRED,
  SERVICE_PIN_TOO_FAR_ALERT_TITLE,
  servicePinTooFarToast,
} from '../../constants/servicePinMessages';
import { useMechanicLiveLocation } from '../../context/MechanicLocationContext';
import { useServicePinMaxOffsetKm, useServicePinMaxOffsetMeters } from '../../hooks/useMechanicDistanceOrigin';
import type { MechanicStackParamList } from '../../navigation/types';
import {
  readFreshGps,
  readLastKnownGps,
  resolveCurrentGps,
  withTimeout,
  type GpsPoint,
} from '../../utils/resolveCurrentGps';
import { isServicePinNearGps } from '../../utils/servicePinGuard';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicWorkLocation'>;

type ProfileStatus = 'loading' | 'ready' | 'error';

/** Ignore map "moves" smaller than this (initial settle / float noise), in degrees (~3 m). */
const MOVE_EPSILON_DEG = 0.00003;
/** After this long, accept map drags even if the profile request is still pending. */
const MAP_INTERACTIVE_AFTER_MS = 3000;
const REVERSE_GEOCODE_DEBOUNCE_MS = 600;

function devLog(message: string, startedAt: number) {
  if (__DEV__) {
    console.log(`[RydAid:ServiceLocation] ${message} +${Date.now() - startedAt}ms`);
  }
}

export function MechanicWorkLocationScreen({ navigation }: Props) {
  const {
    coords: deviceCoords,
    permissionDenied,
    servicePin,
    applySavedMechanicLocation,
  } = useMechanicLiveLocation();
  const maxOffsetKm = useServicePinMaxOffsetKm();
  const maxOffsetMeters = useServicePinMaxOffsetMeters();

  // Seed from the pin the app already loaded so the map mounts at the right spot with no wait.
  const [lat, setLat] = useState<number | null>(servicePin?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(servicePin?.longitude ?? null);
  const [address, setAddress] = useState('');
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapRecenterKey, setMapRecenterKey] = useState(0);

  const mountedAt = useRef(Date.now());
  const mounted = useRef(true);
  const referenceGps = useRef<GpsPoint | null>(null);
  const deviceCoordsRef = useRef(deviceCoords);
  const pinRef = useRef<GpsPoint | null>(servicePin ?? null);
  const userMovedPin = useRef(false);
  const mapInteractive = useRef(servicePin != null);
  const lastFarToastAt = useRef(0);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeSeq = useRef(0);

  useEffect(() => {
    deviceCoordsRef.current = deviceCoords;
  }, [deviceCoords]);

  useEffect(() => {
    mounted.current = true;
    const t = setTimeout(() => {
      mapInteractive.current = true;
    }, MAP_INTERACTIVE_AFTER_MS);
    return () => {
      mounted.current = false;
      clearTimeout(t);
      if (geocodeTimer.current) {
        clearTimeout(geocodeTimer.current);
      }
    };
  }, []);

  const placePin = useCallback((point: GpsPoint, recenter: boolean) => {
    pinRef.current = point;
    mapInteractive.current = true;
    setLat(point.latitude);
    setLng(point.longitude);
    if (recenter) {
      setMapRecenterKey((k) => k + 1);
    }
  }, []);

  /** Debounced, latest-wins reverse geocode. Never blocks the UI. */
  const scheduleReverseGeocode = useCallback(
    (point: GpsPoint, opts?: { delayMs?: number; onlyIfEmpty?: boolean }) => {
      if (geocodeTimer.current) {
        clearTimeout(geocodeTimer.current);
      }
      const seq = ++geocodeSeq.current;
      geocodeTimer.current = setTimeout(() => {
        void (async () => {
          try {
            const rev = await withTimeout(Location.reverseGeocodeAsync(point), 6000, 'reverseGeocode');
            if (seq !== geocodeSeq.current || !mounted.current || !rev[0]) {
              return;
            }
            const line = [rev[0].street, rev[0].district, rev[0].city, rev[0].region]
              .filter(Boolean)
              .join(', ');
            if (line) {
              setAddress((prev) => (opts?.onlyIfEmpty && prev.trim() ? prev : line));
            }
          } catch {
            /* keep typed address */
          }
        })();
      }, opts?.delayMs ?? REVERSE_GEOCODE_DEBOUNCE_MS);
    },
    [],
  );

  /** Use a GPS point as the pin only when nothing better (saved pin / user choice) exists yet. */
  const fallbackPinFromGps = useCallback(
    (point: GpsPoint) => {
      if (pinRef.current) {
        return;
      }
      placePin(point, true);
      scheduleReverseGeocode(point, { delayMs: 0, onlyIfEmpty: true });
    },
    [placePin, scheduleReverseGeocode],
  );

  // 1) Saved profile: runs on mount and on Retry only — never on GPS updates.
  useEffect(() => {
    let cancelled = false;
    const startedAt = mountedAt.current;
    setProfileStatus('loading');
    setProfileError(null);
    fetchMyMechanicProfile()
      .then((profile) => {
        if (cancelled) return;
        devLog('profile loaded', startedAt);
        const pLat = profile?.latitude != null ? Number(profile.latitude) : NaN;
        const pLng = profile?.longitude != null ? Number(profile.longitude) : NaN;
        if (Number.isFinite(pLat) && Number.isFinite(pLng) && !userMovedPin.current) {
          const prev = pinRef.current;
          const moved =
            !prev ||
            Math.abs(prev.latitude - pLat) > MOVE_EPSILON_DEG ||
            Math.abs(prev.longitude - pLng) > MOVE_EPSILON_DEG;
          placePin({ latitude: pLat, longitude: pLng }, moved);
          setAddress((current) => current.trim() || profile?.address || '');
        }
        setProfileStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        devLog('profile failed', startedAt);
        setProfileError(getApiErrorMessage(error));
        setProfileStatus('error');
      })
      .finally(() => {
        if (!cancelled) mapInteractive.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [profileAttempt, placePin]);

  // 2) GPS reference in parallel: cached fix first (instant), then a fresh fix with a timeout.
  useEffect(() => {
    let cancelled = false;
    const startedAt = mountedAt.current;
    void (async () => {
      const last = await readLastKnownGps();
      if (cancelled) return;
      if (last) {
        devLog('last-known GPS', startedAt);
        referenceGps.current = last;
        fallbackPinFromGps(last);
      }
      const fresh = await resolveCurrentGps(deviceCoordsRef.current ?? last, { requestPermission: false });
      if (cancelled) return;
      devLog(fresh ? 'fresh GPS (or fallback) ready' : 'no GPS available', startedAt);
      if (fresh) {
        referenceGps.current = fresh;
        fallbackPinFromGps(fresh);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fallbackPinFromGps]);

  // 3) Live coords from the app-wide watcher: only fill an empty pin, no async work, no loops.
  useEffect(() => {
    if (deviceCoords) {
      fallbackPinFromGps(deviceCoords);
    }
  }, [deviceCoords, fallbackPinFromGps]);

  const onMapReady = useCallback(() => {
    devLog('map ready', mountedAt.current);
  }, []);

  const warnIfPinTooFar = useCallback(
    (pin: GpsPoint) => {
      const ref = referenceGps.current ?? deviceCoordsRef.current;
      if (!ref || isServicePinNearGps(pin, ref, maxOffsetKm)) {
        return;
      }
      const now = Date.now();
      if (now - lastFarToastAt.current < 7000) {
        return;
      }
      lastFarToastAt.current = now;
      showAppToast(servicePinTooFarToast(maxOffsetMeters));
    },
    [maxOffsetKm, maxOffsetMeters],
  );

  const captureDeviceLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Allow location so we can place your pin on the map.');
        return;
      }
      try {
        const enabled = await withTimeout(Location.hasServicesEnabledAsync(), 2000, 'hasServicesEnabled');
        if (!enabled) {
          Alert.alert('Location off', 'Turn on location services, then try again.');
          return;
        }
      } catch {
        /* continue */
      }
      let point: GpsPoint | null = null;
      try {
        point = await readFreshGps(10_000);
      } catch {
        point = (await readLastKnownGps()) ?? deviceCoordsRef.current;
        if (point) {
          showAppToast('GPS is slow — using your last known location.');
        }
      }
      if (!mounted.current) return;
      if (!point) {
        Alert.alert('Location unavailable', 'Could not read GPS. Drag the map to place your pin instead.');
        return;
      }
      referenceGps.current = point;
      userMovedPin.current = true;
      placePin(point, true);
      scheduleReverseGeocode(point, { delayMs: 0 });
    } catch {
      Alert.alert('Location unavailable', 'Could not read GPS. Drag the map to place your pin instead.');
    } finally {
      if (mounted.current) setLocating(false);
    }
  }, [placePin, scheduleReverseGeocode]);

  const onUseMyLocation = useCallback(() => {
    void captureDeviceLocation();
  }, [captureDeviceLocation]);

  const onCenterChange = useCallback(
    (center: GpsPoint) => {
      // Ignore the map's own settle event on first load, before we know where the pin should be.
      if (!mapInteractive.current) {
        return;
      }
      const prev = pinRef.current;
      if (
        prev &&
        Math.abs(prev.latitude - center.latitude) < MOVE_EPSILON_DEG &&
        Math.abs(prev.longitude - center.longitude) < MOVE_EPSILON_DEG
      ) {
        return;
      }
      userMovedPin.current = true;
      placePin(center, false);
      scheduleReverseGeocode(center);
      warnIfPinTooFar(center);
    },
    [placePin, scheduleReverseGeocode, warnIfPinTooFar],
  );

  const mapCenter = useMemo(
    () => (lat != null && lng != null ? { latitude: lat, longitude: lng } : null),
    [lat, lng],
  );

  const save = async () => {
    if (lat == null || lng == null) {
      Alert.alert('Pin required', 'Drag the map or use Pin my location to set where you operate from.');
      return;
    }

    setSaving(true);
    try {
      const gps = await resolveCurrentGps(referenceGps.current ?? deviceCoordsRef.current, { timeoutMs: 6000 });
      if (!gps) {
        Alert.alert('Location required', SERVICE_PIN_GPS_REQUIRED);
        return;
      }
      referenceGps.current = gps;

      if (!isServicePinNearGps({ latitude: lat, longitude: lng }, gps, maxOffsetKm)) {
        Alert.alert(SERVICE_PIN_TOO_FAR_ALERT_TITLE, servicePinTooFarAlertBody(maxOffsetMeters));
        showAppToast(servicePinTooFarToast(maxOffsetMeters));
        return;
      }

      const updated = await updateMechanicProfileLocation(lat, lng, address, {
        source: 'manual',
        gps,
      });
      applySavedMechanicLocation(updated.latitude!, updated.longitude!, true);
      Alert.alert('Location saved', 'Your service pin is updated for matching and incoming requests.', [
        {
          text: 'OK',
          onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('MechanicHome');
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Could not save', getApiErrorMessage(error));
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>{servicePinManualSaveHint(maxOffsetMeters)}</Text>
      <Text style={styles.leadSub}>
        While you are on an active job and on the way, distance uses your live GPS—not this pin.
      </Text>

      {permissionDenied ? (
        <Text style={styles.warning}>Location permission is off — enable GPS to save or adjust your service pin.</Text>
      ) : null}

      {profileStatus === 'loading' ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#0284c7" />
          <Text style={styles.statusText}>Loading your saved pin…</Text>
        </View>
      ) : null}

      {profileStatus === 'error' ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Couldn’t load your saved pin</Text>
          {profileError ? <Text style={styles.errorBody}>{profileError}</Text> : null}
          <Text style={styles.errorBody}>You can still drag the map or tap Pin my location, then save.</Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.saveBtnPressed]}
            onPress={() => setProfileAttempt((n) => n + 1)}
            accessibilityRole="button"
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <LocationPickMap
        center={mapCenter}
        onCenterChange={onCenterChange}
        onUseMyLocation={onUseMyLocation}
        locating={locating}
        recenterKey={mapRecenterKey}
        pickMode="map-center"
        height={340}
        onMapReady={onMapReady}
      />

      <Text style={styles.label}>Address label (optional)</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Street, barangay, city"
        placeholderTextColor="#94a3b8"
      />

      {lat != null && lng != null ? (
        <Text style={styles.coords}>
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed, saving && styles.saveBtnBusy]}
        onPress={() => void save()}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save service location</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusText: { fontSize: 13, color: '#64748b' },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: '#991b1b', marginBottom: 4 },
  errorBody: { fontSize: 13, lineHeight: 18, color: '#7f1d1d', marginBottom: 4 },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  lead: { fontSize: 15, lineHeight: 22, color: '#475569', marginBottom: 8 },
  leadSub: { fontSize: 13, lineHeight: 19, color: '#64748b', marginBottom: 12 },
  warning: {
    fontSize: 13,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    lineHeight: 18,
  },
  label: { marginTop: 16, fontSize: 13, fontWeight: '600', color: '#64748b' },
  input: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  coords: { marginTop: 8, fontSize: 12, color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  saveBtn: {
    marginTop: 20,
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnPressed: { opacity: 0.92 },
  saveBtnBusy: { opacity: 0.8 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
