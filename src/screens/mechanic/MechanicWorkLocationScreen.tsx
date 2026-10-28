import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { resolveCurrentGps, type GpsPoint } from '../../utils/resolveCurrentGps';
import { isServicePinNearGps } from '../../utils/servicePinGuard';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicWorkLocation'>;

export function MechanicWorkLocationScreen({ navigation }: Props) {
  const { coords: deviceCoords, permissionDenied, applySavedMechanicLocation } = useMechanicLiveLocation();
  const maxOffsetKm = useServicePinMaxOffsetKm();
  const maxOffsetMeters = useServicePinMaxOffsetMeters();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const referenceGps = useRef<GpsPoint | null>(null);
  const lastFarToastAt = useRef(0);
  const [mapRecenterKey, setMapRecenterKey] = useState(0);

  const bumpMapToPin = useCallback(() => {
    setMapRecenterKey((k) => k + 1);
  }, []);

  const refreshReferenceGps = useCallback(async () => {
    const point = await resolveCurrentGps(deviceCoords);
    if (point) {
      referenceGps.current = point;
    }
    return point;
  }, [deviceCoords]);

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (rev[0]) {
        const line = [rev[0].street, rev[0].district, rev[0].city, rev[0].region]
          .filter(Boolean)
          .join(', ');
        if (line) setAddress(line);
      }
    } catch {
      /* keep typed address */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshReferenceGps();
        const profile = await fetchMyMechanicProfile();
        if (cancelled) return;
        if (profile?.latitude != null && profile?.longitude != null) {
          setLat(profile.latitude);
          setLng(profile.longitude);
          setAddress(profile.address ?? '');
          bumpMapToPin();
        } else if (deviceCoords) {
          setLat(deviceCoords.latitude);
          setLng(deviceCoords.longitude);
          await reverseGeocode(deviceCoords.latitude, deviceCoords.longitude);
          bumpMapToPin();
        } else if (referenceGps.current) {
          setLat(referenceGps.current.latitude);
          setLng(referenceGps.current.longitude);
          bumpMapToPin();
        }
      } catch {
        if (!cancelled && deviceCoords) {
          setLat(deviceCoords.latitude);
          setLng(deviceCoords.longitude);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceCoords, reverseGeocode, refreshReferenceGps, bumpMapToPin]);

  const warnIfPinTooFar = useCallback(
    (pin: GpsPoint) => {
      const ref = referenceGps.current ?? deviceCoords;
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
    [deviceCoords, maxOffsetKm, maxOffsetMeters],
  );

  const captureDeviceLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Allow location so we can place your pin on the map.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      referenceGps.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      bumpMapToPin();
    } finally {
      setLocating(false);
    }
  };

  const onCenterChange = (center: { latitude: number; longitude: number }) => {
    setLat(center.latitude);
    setLng(center.longitude);
    void reverseGeocode(center.latitude, center.longitude);
    warnIfPinTooFar(center);
  };

  const save = async () => {
    if (lat == null || lng == null) {
      Alert.alert('Pin required', 'Tap the map or use Pin my location to set where you operate from.');
      return;
    }

    const gps = await refreshReferenceGps();
    if (!gps) {
      Alert.alert('Location required', SERVICE_PIN_GPS_REQUIRED);
      return;
    }

    if (!isServicePinNearGps({ latitude: lat, longitude: lng }, gps, maxOffsetKm)) {
      Alert.alert(SERVICE_PIN_TOO_FAR_ALERT_TITLE, servicePinTooFarAlertBody(maxOffsetMeters));
      showAppToast(servicePinTooFarToast(maxOffsetMeters));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMechanicProfileLocation(lat, lng, address, {
        source: 'manual',
        gps,
      });
      applySavedMechanicLocation(updated.latitude!, updated.longitude!, true);
      Alert.alert('Location saved', 'Your service pin is updated for matching and incoming requests.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Could not save', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>{servicePinManualSaveHint(maxOffsetMeters)}</Text>
      <Text style={styles.leadSub}>
        While you are on an active job and on the way, distance uses your live GPS—not this pin.
      </Text>

      {permissionDenied ? (
        <Text style={styles.warning}>Location permission is off — enable GPS to save or adjust your service pin.</Text>
      ) : null}

      <LocationPickMap
        center={lat != null && lng != null ? { latitude: lat, longitude: lng } : null}
        onCenterChange={onCenterChange}
        onUseMyLocation={() => void captureDeviceLocation()}
        locating={locating}
        recenterKey={mapRecenterKey}
        pickMode="map-center"
        height={340}
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
        style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
