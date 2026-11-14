import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage } from '../../api/client';
import {
  createMechanicProfile,
  fetchMyMechanicProfile,
  updateMechanicProfile,
  type GovIdType,
  type MechanicProfilePayload,
} from '../../api/mechanicProfile';
import { CenteredLoading } from '../../components/CenteredLoading';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { LocationPickMap } from '../../components/LocationPickMap';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { MechanicStackParamList } from '../../navigation/types';
import { stickyFooterBottomPadding } from '../../utils/screenInsets';
import { logger } from '../../utils/logger';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicOnboarding'>;

const GOV_ID_OPTIONS: { value: GovIdType; label: string }[] = [
  { value: 'drivers_license', label: "Driver's license" },
  { value: 'national_id', label: 'National ID' },
  { value: 'umid', label: 'UMID' },
  { value: 'passport', label: 'Passport' },
  { value: 'other', label: 'Other ID' },
];

function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={styles.labelWrap}>
      <Text style={styles.label}>{children}</Text>
      {hint ? <Text style={styles.labelHint}>{hint}</Text> : null}
    </View>
  );
}

function EmergencyToggle({
  featureOn,
  isNew,
  value,
  onChange,
}: {
  featureOn: boolean;
  isNew: boolean;
  value: boolean | null;
  onChange: (next: boolean) => void;
}) {
  // New listings default ON (HELP matching needs this). Existing listings use the stored value.
  const shown = value ?? (isNew ? true : false);
  const unknown = !isNew && value == null;
  const disabled = !featureOn || unknown;
  const helper = !featureOn
    ? isNew
      ? "Emergency help isn't live in your area yet. You can turn this on once it launches."
      : `Emergency help isn't live in your area yet. Your current choice (${value === true ? 'on' : value === false ? 'off' : 'not set'}) stays saved.`
    : unknown
      ? "We couldn't load this setting. Saving won't change it — reopen this screen to try again."
      : 'Required to receive roadside HELP nearby. Turn off only if you want service jobs only.';

  return (
    <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
      <View style={styles.toggleText}>
        <Text style={styles.label} nativeID="emergencyToggleLabel">
          Accept emergency requests
        </Text>
        <Text style={styles.toggleHelper}>{helper}</Text>
      </View>
      <Switch
        value={shown}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#cbd5e1', true: '#7dd3fc' }}
        thumbColor={shown ? '#0284c7' : '#f8fafc'}
        ios_backgroundColor="#cbd5e1"
        accessibilityRole="switch"
        accessibilityLabel="Accept emergency requests"
        accessibilityHint={helper}
        accessibilityState={{ checked: shown, disabled }}
        accessibilityLabelledBy="emergencyToggleLabel"
      />
    </View>
  );
}

export function MechanicOnboardingScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const insets = useSafeAreaInsets();
  const footerPad = stickyFooterBottomPadding(insets);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const defaultServiceRadius = config?.directory.default_mechanic_service_radius_km ?? 15;
  const [serviceRadiusKm, setServiceRadiusKm] = useState(String(defaultServiceRadius));
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [govIdType, setGovIdType] = useState<GovIdType>('national_id');
  const [govIdNumber, setGovIdNumber] = useState('');
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);
  const [idSelfieUri, setIdSelfieUri] = useState<string | null>(null);
  const [verificationRejectionReason, setVerificationRejectionReason] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const emergencyFeatureOn = config?.features?.emergency_assistance ?? false;
  /** Stored listing value; null until loaded (or when the server did not send it). */
  const [emergencyAvailable, setEmergencyAvailable] = useState<boolean | null>(null);
  /** Stored mobile-service flag, kept as-is on save (no UI for it yet). */
  const [mobileServiceAvailable, setMobileServiceAvailable] = useState<boolean | null>(null);
  const [mapRecenterKey, setMapRecenterKey] = useState(0);
  const addressRef = useRef(address);
  addressRef.current = address;

  const bumpMapToPin = useCallback(() => {
    setMapRecenterKey((k) => k + 1);
  }, []);

  const reverseGeocodeIfEmpty = useCallback(async (lat: number, lng: number) => {
    if (addressRef.current.trim()) return;
    try {
      const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (!rev[0]) return;
      const line = [rev[0].street, rev[0].district, rev[0].city, rev[0].region]
        .filter(Boolean)
        .join(', ');
      if (line && !addressRef.current.trim()) {
        setAddress(line);
      }
    } catch {
      /* keep typed address */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMyMechanicProfile()
      .then((profile) => {
        if (cancelled || !profile) return;
        setExistingId(profile.id);
        setBusinessName(profile.business_name ?? '');
        setPhone(profile.phone ?? '');
        setAddress(profile.address ?? '');
        setVerificationStatus(profile.verification_status ?? null);
        setVerificationRejectionReason(profile.identity_verification?.rejection_reason ?? null);
        setEmergencyAvailable(
          typeof profile.emergency_available === 'boolean' ? profile.emergency_available : null,
        );
        setMobileServiceAvailable(
          typeof profile.mobile_service_available === 'boolean' ? profile.mobile_service_available : null,
        );
        if (profile.service_radius_km) {
          setServiceRadiusKm(String(profile.service_radius_km));
        }
        const lat = profile.latitude != null ? Number(profile.latitude) : NaN;
        const lng = profile.longitude != null ? Number(profile.longitude) : NaN;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setLatitude(lat);
          setLongitude(lng);
          bumpMapToPin();
        }
      })
      .catch((error) => {
        logger.error('MechanicOnboarding', 'Failed to load profile', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bumpMapToPin]);

  const statusMeta = useMemo(() => {
    if (verificationStatus === 'verified') {
      return { title: 'Verified listing', body: 'Your public listing is approved.', tone: 'ok' as const };
    }
    if (verificationStatus === 'rejected') {
      return {
        title: 'Needs updates',
        body: verificationRejectionReason || 'Fix the issues below and resubmit.',
        tone: 'danger' as const,
      };
    }
    if (verificationStatus === 'pending' || existingId) {
      return {
        title: 'Under review',
        body: 'You can keep editing details while we verify your ID.',
        tone: 'warn' as const,
      };
    }
    return {
      title: 'Create your listing',
      body: 'Free to join — verify identity, then add your service details.',
      tone: 'info' as const,
    };
  }, [verificationStatus, verificationRejectionReason, existingId]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Allow location to pin your service area.');
        return;
      }
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          Alert.alert('Location off', 'Turn on location services, then try again.');
          return;
        }
      } catch {
        /* continue */
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);
      bumpMapToPin();
      void reverseGeocodeIfEmpty(lat, lng);
    } catch {
      Alert.alert('Location unavailable', 'Could not read GPS. Drag the map to place your pin.');
    } finally {
      setLocating(false);
    }
  };

  const onMapCenterChange = useCallback(
    (center: { latitude: number; longitude: number }) => {
      setLatitude(center.latitude);
      setLongitude(center.longitude);
      void reverseGeocodeIfEmpty(center.latitude, center.longitude);
    },
    [reverseGeocodeIfEmpty],
  );

  const pickPhoto = async (kind: 'document' | 'selfie') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera required', 'Allow camera access to upload your ID for verification.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }
    if (kind === 'document') {
      setIdDocumentUri(result.assets[0].uri);
    } else {
      setIdSelfieUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!existingId) {
      if (!govIdNumber.trim()) {
        Alert.alert('ID number required', 'Enter the number on your government ID.');
        return;
      }
      if (!idDocumentUri || !idSelfieUri) {
        Alert.alert(
          'Photos required',
          'Upload a clear photo of your ID and a selfie holding the same ID before submitting.',
        );
        return;
      }
    }
    if (latitude == null || longitude == null) {
      Alert.alert('Set location', 'Pin your service spot on the map, or tap Pin my location.');
      return;
    }
    setSaving(true);
    try {
      // Only send flags we actually know. When a value is unknown (or emergency is
      // switched off platform-wide), omit it so the server keeps what is stored.
      const emergencyChoice = existingId
        ? emergencyFeatureOn
          ? emergencyAvailable
          : null
        : emergencyFeatureOn
          ? (emergencyAvailable ?? true)
          : null;
      const payload: MechanicProfilePayload = {
        business_name: businessName.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        latitude,
        longitude,
        service_radius_km: parseInt(serviceRadiusKm, 10) || 15,
        ...(existingId
          ? mobileServiceAvailable != null
            ? { mobile_service_available: mobileServiceAvailable }
            : {}
          : { mobile_service_available: true }),
        ...(emergencyChoice != null ? { emergency_available: emergencyChoice } : {}),
      };
      if (existingId) {
        await updateMechanicProfile(payload);
      } else {
        await createMechanicProfile({
          ...payload,
          gov_id_type: govIdType,
          gov_id_number: govIdNumber.trim(),
          idDocumentUri: idDocumentUri!,
          idSelfieUri: idSelfieUri!,
        });
      }
      Alert.alert(
        existingId ? 'Listing updated' : 'Listing submitted',
        existingId
          ? 'Your listing details were saved.'
          : 'Your ID and listing were sent for review. Once approved, you can go online and get nearby requests.',
        [
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
        ],
      );
    } catch (error) {
      Alert.alert('Could not save', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CenteredLoading message="Loading your listing…" />;
  }

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={[styles.container, { paddingBottom: 24 + footerPad + 72 }]}
        extraBottomPadding={40}
      >
        <View
          style={[
            styles.statusBanner,
            statusMeta.tone === 'ok' && styles.statusOk,
            statusMeta.tone === 'warn' && styles.statusWarn,
            statusMeta.tone === 'danger' && styles.statusDanger,
            statusMeta.tone === 'info' && styles.statusInfo,
          ]}
        >
          <Text style={styles.statusEyebrow}>Profile</Text>
          <Text style={styles.statusTitle}>{statusMeta.title}</Text>
          <Text style={styles.statusBody}>{statusMeta.body}</Text>
        </View>

        {!existingId ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Step 1</Text>
            <Text style={styles.cardTitle}>Identity verification</Text>
            <Text style={styles.cardHint}>
              We verify your ID so one person cannot open multiple mechanic accounts.
            </Text>

            <FieldLabel>ID type</FieldLabel>
            <View style={styles.chipWrap}>
              {GOV_ID_OPTIONS.map((opt) => {
                const on = govIdType === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, on && styles.chipActive]}
                    onPress={() => setGovIdType(opt.value)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <FieldLabel hint="Exactly as printed">ID number</FieldLabel>
            <TextInput
              style={styles.input}
              value={govIdNumber}
              onChangeText={setGovIdNumber}
              autoCapitalize="characters"
              placeholder="As printed on your ID"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.photoRow}>
              <Pressable
                style={[styles.photoCard, idDocumentUri && styles.photoCardDone]}
                onPress={() => void pickPhoto('document')}
              >
                <Text style={styles.photoTitle}>{idDocumentUri ? 'ID captured' : 'ID photo'}</Text>
                <Text style={styles.photoSub}>
                  {idDocumentUri ? 'Tap to retake' : 'Front of government ID'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.photoCard, idSelfieUri && styles.photoCardDone]}
                onPress={() => void pickPhoto('selfie')}
              >
                <Text style={styles.photoTitle}>{idSelfieUri ? 'Selfie captured' : 'Selfie with ID'}</Text>
                <Text style={styles.photoSub}>
                  {idSelfieUri ? 'Tap to retake' : 'Hold the same ID'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>{existingId ? 'Listing' : 'Step 2'}</Text>
          <Text style={styles.cardTitle}>Your details</Text>
          <Text style={styles.cardHint}>
            Freelancers can skip shop name — owners will see {user?.name?.trim() || 'your account name'}.
          </Text>

          <FieldLabel hint="Optional — for shop owners">Business / shop name</FieldLabel>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Leave blank if you work freelance"
            placeholderTextColor="#94a3b8"
          />

          <FieldLabel>Phone</FieldLabel>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="09XXXXXXXXX"
            placeholderTextColor="#94a3b8"
          />

          <FieldLabel hint="Optional">Base area / address</FieldLabel>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="City or usual coverage area"
            placeholderTextColor="#94a3b8"
          />

          <FieldLabel hint="How far you can travel">Service radius (km)</FieldLabel>
          <TextInput
            style={styles.input}
            value={serviceRadiusKm}
            onChangeText={setServiceRadiusKm}
            keyboardType="number-pad"
            placeholder={String(defaultServiceRadius)}
            placeholderTextColor="#94a3b8"
          />

          <EmergencyToggle
            featureOn={emergencyFeatureOn}
            isNew={!existingId}
            value={emergencyAvailable}
            onChange={setEmergencyAvailable}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Service location</Text>
          <Text style={styles.cardHint}>
            Pin where you operate. Tap Pin my location, or drag the map to move the pin.
          </Text>

          <LocationPickMap
            center={
              latitude != null && longitude != null
                ? { latitude, longitude }
                : null
            }
            onCenterChange={onMapCenterChange}
            onUseMyLocation={() => void useMyLocation()}
            locating={locating}
            recenterKey={mapRecenterKey}
            pickMode="map-center"
            height={280}
          />

          {latitude != null && longitude != null ? (
            <Text style={styles.coordsValue}>
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.coordsMissing}>No pin yet — place one on the map to continue.</Text>
          )}
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: footerPad }]}>
        <Pressable
          style={({ pressed }) => [styles.primary, saving && styles.primaryDisabled, pressed && !saving && styles.pressed]}
          onPress={() => void submit()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {existingId ? 'Save listing' : 'Submit for verification'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  container: { padding: 16, gap: 12 },
  pressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  statusBanner: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  statusInfo: { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' },
  statusWarn: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  statusDanger: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  statusOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  statusEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 4,
  },
  statusTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  statusBody: { marginTop: 6, fontSize: 14, lineHeight: 20, color: '#475569' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0284c7',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  cardHint: { marginTop: 4, marginBottom: 14, fontSize: 13, lineHeight: 18, color: '#64748b' },
  labelWrap: { marginBottom: 6 },
  label: { fontWeight: '700', color: '#0f172a', fontSize: 13 },
  labelHint: { marginTop: 2, fontSize: 12, color: '#94a3b8' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    color: '#0f172a',
    fontSize: 15,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#0369a1', fontWeight: '800' },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoCard: {
    flex: 1,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
    padding: 12,
    justifyContent: 'center',
  },
  photoCardDone: {
    borderStyle: 'solid',
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  photoTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  photoSub: { marginTop: 4, fontSize: 12, color: '#64748b', lineHeight: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  toggleRowDisabled: { opacity: 0.6 },
  toggleText: { flex: 1 },
  toggleHelper: { marginTop: 3, fontSize: 12, lineHeight: 17, color: '#64748b' },
  coordsValue: { marginTop: 10, fontSize: 13, fontWeight: '600', color: '#64748b' },
  coordsMissing: { marginTop: 10, fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(238,242,246,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  primary: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.7 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
