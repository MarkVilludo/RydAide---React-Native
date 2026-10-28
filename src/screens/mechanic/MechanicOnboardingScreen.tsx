import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import { fetchVehicleTypes } from '../../api/catalog';
import {
  createMechanicProfile,
  fetchMyMechanicProfile,
  updateMechanicProfile,
  type GovIdType,
} from '../../api/mechanicProfile';
import type { MechanicStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicOnboarding'>;

const GOV_ID_OPTIONS: { value: GovIdType; label: string }[] = [
  { value: 'drivers_license', label: "Driver's license" },
  { value: 'national_id', label: 'National ID (PhilSys)' },
  { value: 'umid', label: 'UMID' },
  { value: 'passport', label: 'Passport' },
  { value: 'other', label: 'Other government ID' },
];

export function MechanicOnboardingScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('15');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [vehicleTypeIds, setVehicleTypeIds] = useState<number[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<{ id: number; name: string }[]>([]);
  const [govIdType, setGovIdType] = useState<GovIdType>('national_id');
  const [govIdNumber, setGovIdNumber] = useState('');
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);
  const [idSelfieUri, setIdSelfieUri] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchMyMechanicProfile(), fetchVehicleTypes()])
      .then(([profile, types]) => {
        setVehicleTypes(types);
        if (profile) {
          setExistingId(profile.id);
          setBusinessName(profile.business_name);
          setPhone(profile.phone ?? '');
          setAddress(profile.address ?? '');
          if (profile.service_radius_km) {
            setServiceRadiusKm(String(profile.service_radius_km));
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location required', 'Allow location to pin your service area.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    setLatitude(position.coords.latitude);
    setLongitude(position.coords.longitude);
  };

  const toggleType = (id: number) => {
    setVehicleTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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
    if (!businessName.trim()) {
      Alert.alert('Business name required');
      return;
    }
    if (latitude == null || longitude == null) {
      Alert.alert('Set location', 'Use “Use my location” so drivers can find you on the map.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        latitude,
        longitude,
        service_radius_km: parseInt(serviceRadiusKm, 10) || 15,
        vehicle_type_ids: vehicleTypeIds,
        mobile_service_available: true,
        emergency_available: false,
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
        'Listing saved',
        'Your ID and listing were submitted. An admin will verify them before you appear in the public directory.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert('Could not save', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.lead}>
        Free registration — no payment or subscription. Verify your identity first, then complete your listing.
      </Text>

      {!existingId && (
        <>
          <Text style={styles.sectionTitle}>Step 1 — Identity verification</Text>
          <Text style={styles.hint}>
            We check your ID so one person cannot create multiple accounts with different email or phone numbers.
          </Text>

          <Text style={styles.label}>ID type</Text>
          {GOV_ID_OPTIONS.map((opt) => (
            <Pressable key={opt.value} style={styles.chip} onPress={() => setGovIdType(opt.value)}>
              <Text style={govIdType === opt.value ? styles.chipOn : styles.chipOff}>{opt.label}</Text>
            </Pressable>
          ))}

          <Text style={styles.label}>ID number</Text>
          <TextInput
            style={styles.input}
            value={govIdNumber}
            onChangeText={setGovIdNumber}
            autoCapitalize="characters"
            placeholder="As printed on your ID"
          />

          <Pressable style={styles.secondaryBtn} onPress={() => pickPhoto('document')}>
            <Text style={styles.secondaryText}>
              {idDocumentUri ? 'Retake ID photo' : 'Take photo of ID (front)'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => pickPhoto('selfie')}>
            <Text style={styles.secondaryText}>
              {idSelfieUri ? 'Retake selfie with ID' : 'Take selfie holding your ID'}
            </Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Step 2 — Listing details</Text>
        </>
      )}

      <Text style={styles.label}>Business name</Text>
      <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />

      <Text style={styles.label}>Service radius (km)</Text>
      <TextInput style={styles.input} value={serviceRadiusKm} onChangeText={setServiceRadiusKm} keyboardType="number-pad" />

      <Pressable style={styles.secondaryBtn} onPress={useMyLocation}>
        <Text style={styles.secondaryText}>Use my location</Text>
      </Pressable>
      {latitude != null && (
        <Text style={styles.coords}>
          Pin: {latitude.toFixed(5)}, {longitude?.toFixed(5)}
        </Text>
      )}

      <Text style={[styles.label, { marginTop: 16 }]}>Vehicle types you service</Text>
      {vehicleTypes.map((t) => (
        <Pressable key={t.id} style={styles.chip} onPress={() => toggleType(t.id)}>
          <Text style={vehicleTypeIds.includes(t.id) ? styles.chipOn : styles.chipOff}>{t.name}</Text>
        </Pressable>
      ))}

      <Pressable style={styles.primary} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit for verification</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lead: { color: '#475569', marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 8, marginTop: 8 },
  hint: { color: '#64748b', marginBottom: 12, lineHeight: 20 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  secondaryBtn: { padding: 12, alignItems: 'center' },
  secondaryText: { color: '#0284c7', fontWeight: '600' },
  coords: { color: '#64748b', fontSize: 12 },
  chip: { marginBottom: 8 },
  chipOn: { color: '#0284c7', fontWeight: '700' },
  chipOff: { color: '#64748b' },
  primary: {
    marginTop: 24,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});
