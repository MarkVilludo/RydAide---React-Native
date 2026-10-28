import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useRef, useState } from 'react';
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
import {
  createHelpRequest,
  fetchCategoryQuestions,
  fetchProblemCategories,
  type ProblemCategory,
} from '../../api/helpRequests';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { LocationPickMap } from '../../components/LocationPickMap';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useEnsureNearbyProviders } from '../../hooks/useEnsureNearbyProviders';
import type { OwnerStackParamList } from '../../navigation/types';
import { NeedHelpVehicleStep } from './NeedHelpVehicleStep';

type Props = NativeStackScreenProps<OwnerStackParamList, 'NeedHelp'>;

type Step = 'vehicle' | 'problem' | 'location' | 'review';

const STEPS: Step[] = ['vehicle', 'problem', 'location', 'review'];

export function NeedHelpScreen({ navigation, route }: Props) {
  const emergency = route.params?.emergency ?? true;
  const { config } = useAppConfig();
  const submitLock = useRef(false);

  const [step, setStep] = useState<Step>('vehicle');
  const [vehicleDescription, setVehicleDescription] = useState('');

  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState('');
  const [questions, setQuestions] = useState<Array<{ id: number; question_text: string }>>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [photoUris, setPhotoUris] = useState<string[]>([]);

  const [lat, setLat] = useState<number | null>(route.params?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(route.params?.longitude ?? null);
  const [landmark, setLandmark] = useState('');
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEnsureNearbyProviders(lat, lng, config?.features.dynamic_nearby_seed === true);

  React.useEffect(() => {
    fetchProblemCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  React.useEffect(() => {
    if (!categoryId) return;
    fetchCategoryQuestions(categoryId)
      .then(setQuestions)
      .catch(() => setQuestions([]));
    setAnswers({});
  }, [categoryId]);

  const stepIndex = STEPS.indexOf(step);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (rev[0]) {
        const line = [rev[0].street, rev[0].city, rev[0].region].filter(Boolean).join(', ');
        setAddress(line);
      }
    } catch {
      setAddress('');
    }
  };

  const captureLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'We need your location to dispatch nearby mechanics.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    } finally {
      setLocating(false);
    }
  };

  React.useEffect(() => {
    if (lat != null && lng != null && !address) {
      reverseGeocode(lat, lng);
    }
  }, [lat, lng]);

  const onCenterChange = (center: { latitude: number; longitude: number }) => {
    setLat(center.latitude);
    setLng(center.longitude);
    reverseGeocode(center.latitude, center.longitude);
  };

  const vehicleValid = () => {
    const line = vehicleDescription.trim();
    const main = line.split(' · ')[0]?.trim() ?? line;
    return main.length >= 2;
  };

  const problemValid = () => categoryId != null && remarks.trim().length >= 10;

  const locationValid = () => lat != null && lng != null;

  const goNext = () => {
    if (step === 'vehicle' && !vehicleValid()) {
      Alert.alert('Vehicle', 'Describe your vehicle (at least 2 characters).');
      return;
    }
    if (step === 'problem' && !problemValid()) {
      Alert.alert('Problem', 'Pick a category and describe what happened (10+ characters).');
      return;
    }
    if (step === 'location' && !locationValid()) {
      Alert.alert('Location', 'Confirm where you need help on the map.');
      return;
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const pickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach images of the problem.');
      return;
    }
    const remaining = 2 - photoUris.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', 'You can attach up to 2 photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 2));
    }
  };

  const submit = async () => {
    if (submitLock.current || submitting) return;
    if (!vehicleValid() || !categoryId || !problemValid() || lat === null || lng === null) {
      Alert.alert('Incomplete', 'Check all steps before submitting.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const addressText = [landmark.trim(), address].filter(Boolean).join(' · ') || address;
      const helpRequest = await createHelpRequest({
        vehicle_description: vehicleDescription.trim().slice(0, 255),
        problem_category_id: categoryId,
        request_type: emergency ? 'EMERGENCY' : 'SERVICE',
        remarks: remarks.trim(),
        latitude: lat,
        longitude: lng,
        address_text: addressText || undefined,
        answers: Object.entries(answers).map(([question_id, answer]) => ({
          question_id: Number(question_id),
          answer,
        })),
        photoUris: photoUris.length > 0 ? photoUris : undefined,
      });
      navigation.replace('ActiveHelpRequest', { helpRequestId: helpRequest.id });
    } catch (error) {
      submitLock.current = false;
      Alert.alert('Could not submit', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <View style={styles.root}>
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressDot, i <= stepIndex && styles.progressDotOn]} />
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {step === 'vehicle' && (
          <NeedHelpVehicleStep value={vehicleDescription} onChange={setVehicleDescription} />
        )}

        {step === 'problem' && (
          <>
            <Text style={styles.title}>What happened?</Text>
            <View style={styles.chips}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chip, categoryId === c.id && styles.chipOn]}
                  onPress={() => setCategoryId(c.id)}
                >
                  <Text style={categoryId === c.id ? styles.chipOnText : undefined}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
            {questions.map((q) => (
              <View key={q.id} style={{ marginTop: 12 }}>
                <Text style={styles.subLabel}>{q.question_text}</Text>
                <View style={styles.chips}>
                  {['yes', 'no', 'unsure'].map((opt) => (
                    <Pressable
                      key={opt}
                      style={[styles.chip, answers[q.id] === opt && styles.chipOn]}
                      onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    >
                      <Text style={answers[q.id] === opt ? styles.chipOnText : undefined}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Text style={styles.label}>Details</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Describe the problem (10+ characters)…"
              value={remarks}
              onChangeText={setRemarks}
            />
            <Pressable style={styles.secondaryBtn} onPress={pickPhotos}>
              <Text style={styles.secondaryBtnText}>
                {photoUris.length === 0 ? 'Add photos (optional)' : `Photos (${photoUris.length}/2)`}
              </Text>
            </Pressable>
            {photoUris.length > 0 ? (
              <HelpRequestPhotoGallery localUris={photoUris} title="Attached photos" compact />
            ) : null}
          </>
        )}

        {step === 'location' && (
          <>
            <Text style={styles.title}>Where are you?</Text>
            <LocationPickMap
              center={lat != null && lng != null ? { latitude: lat, longitude: lng } : null}
              onCenterChange={onCenterChange}
              onUseMyLocation={captureLocation}
              locating={locating}
              height={240}
            />
            <Text style={styles.label}>Landmark or directions (optional)</Text>
            <TextInput
              style={styles.singleLineInput}
              placeholder="e.g. beside 7-Eleven, northbound lane"
              value={landmark}
              onChangeText={setLandmark}
            />
            {address ? <Text style={styles.meta}>{address}</Text> : null}
          </>
        )}

        {step === 'review' && lat != null && lng != null && (
          <>
            <Text style={styles.title}>Review & request</Text>
            <GrabStyleBottomSheet>
              <ReviewRow label="Vehicle" value={vehicleDescription.trim() || '—'} />
              <ReviewRow label="Problem" value={selectedCategory?.name ?? '—'} />
              <ReviewRow label="Details" value={remarks} />
              <ReviewRow
                label="Location"
                value={[landmark, address].filter(Boolean).join(' · ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
              />
              <HelpRequestMap
                request={{ latitude: lat, longitude: lng, title: 'You' }}
                height={140}
              />
              <Text style={styles.reviewHint}>
                {emergency
                  ? 'We notify nearby verified mechanics. The first to accept comes to you.'
                  : 'We will match you with an available mechanic.'}
              </Text>
            </GrabStyleBottomSheet>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.backBtn} onPress={goBack} disabled={submitting}>
          <Text style={styles.backBtnText}>{stepIndex === 0 ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        {step !== 'review' ? (
          <Pressable style={styles.primary} onPress={goNext}>
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primary} onPress={submit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{emergency ? 'Request help now' : 'Submit request'}</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  progressDotOn: { backgroundColor: '#0284c7' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  label: { fontWeight: '600', marginTop: 16, marginBottom: 8 },
  subLabel: { fontSize: 13, color: '#475569', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipOn: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  chipOnText: { color: '#fff', fontWeight: '600' },
  input: {
    minHeight: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
  },
  singleLineInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
  },
  secondaryBtn: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0284c7',
    borderRadius: 10,
  },
  secondaryBtnText: { color: '#0284c7', fontWeight: '600' },
  meta: { marginTop: 8, color: '#64748b' },
  reviewRow: { marginBottom: 10 },
  reviewLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  reviewValue: { fontSize: 15, color: '#0f172a', marginTop: 2, lineHeight: 20 },
  reviewHint: { marginTop: 12, color: '#64748b', fontSize: 13, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  backBtn: { paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center' },
  backBtnText: { color: '#64748b', fontWeight: '600' },
  primary: {
    flex: 1,
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});
