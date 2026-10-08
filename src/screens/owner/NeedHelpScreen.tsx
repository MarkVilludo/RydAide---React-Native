import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import {
  createHelpRequest,
  fetchCategoryQuestions,
  fetchProblemCategories,
  type ProblemCategory,
} from '../../api/helpRequests';
import { fetchVehicles, type Vehicle } from '../../api/vehicles';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'NeedHelp'>;

export function NeedHelpScreen({ navigation, route }: Props) {
  const emergency = route.params?.emergency ?? true;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [remarks, setRemarks] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Array<{ id: number; question_text: string }>>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchVehicles().then((v) => {
      setVehicles(v);
      if (v[0]) setVehicleId(v[0].id);
    });
    fetchProblemCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!categoryId) return;
    fetchCategoryQuestions(categoryId).then(setQuestions);
    setAnswers({});
  }, [categoryId]);

  const captureLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location required', 'We need your location to dispatch nearby mechanics.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setLat(pos.coords.latitude);
    setLng(pos.coords.longitude);
    const rev = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    if (rev[0]) {
      const line = [rev[0].street, rev[0].city, rev[0].region].filter(Boolean).join(', ');
      setAddress(line);
    }
  };

  const submit = async () => {
    if (!vehicleId || !categoryId || remarks.length < 10 || lat === null || lng === null) {
      Alert.alert('Incomplete', 'Select vehicle, problem, describe what happened (10+ chars), and confirm location.');
      return;
    }
    setSubmitting(true);
    try {
      const helpRequest = await createHelpRequest({
        vehicle_id: vehicleId,
        problem_category_id: categoryId,
        request_type: emergency ? 'EMERGENCY' : 'SERVICE',
        remarks,
        latitude: lat,
        longitude: lng,
        address_text: address,
        answers: Object.entries(answers).map(([question_id, answer]) => ({
          question_id: Number(question_id),
          answer,
        })),
      });
      navigation.replace('ActiveHelpRequest', { helpRequestId: helpRequest.id });
    } catch (error) {
      Alert.alert('Could not submit', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.banner}>{emergency ? '🆘 EMERGENCY HELP' : 'Request service'}</Text>
      <Text style={styles.hint}>We will notify nearby qualified mechanics. You do not pick a mechanic manually.</Text>

      <Text style={styles.label}>1. Vehicle</Text>
      <View style={styles.chips}>
        {vehicles.map((v) => (
          <Pressable key={v.id} style={[styles.chip, vehicleId === v.id && styles.chipOn]} onPress={() => setVehicleId(v.id)}>
            <Text style={vehicleId === v.id ? styles.chipOnText : undefined}>{v.nickname ?? 'Vehicle'}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>2. Problem</Text>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Pressable key={c.id} style={[styles.chip, categoryId === c.id && styles.chipOn]} onPress={() => setCategoryId(c.id)}>
            <Text style={categoryId === c.id ? styles.chipOnText : undefined}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      {questions.map((q) => (
        <View key={q.id} style={{ marginBottom: 8 }}>
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

      <Text style={styles.label}>3. Describe what happened</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Motor suddenly stopped while riding..."
        value={remarks}
        onChangeText={setRemarks}
      />

      <Text style={styles.label}>4. Location</Text>
      <Pressable style={styles.secondaryBtn} onPress={captureLocation}>
        <Text style={styles.secondaryBtnText}>{lat ? 'Update location' : 'Use my current location'}</Text>
      </Pressable>
      {lat !== null && <Text style={styles.meta}>{address || `${lat.toFixed(4)}, ${lng?.toFixed(4)}`}</Text>}

      <Pressable style={styles.primary} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit — find mechanics</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  banner: { fontSize: 20, fontWeight: '700', color: '#b91c1c' },
  hint: { color: '#64748b', marginVertical: 12 },
  label: { fontWeight: '600', marginTop: 16, marginBottom: 8 },
  subLabel: { fontSize: 13, color: '#475569', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' },
  chipOn: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  chipOnText: { color: '#fff', fontWeight: '600' },
  input: { minHeight: 100, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, textAlignVertical: 'top' },
  secondaryBtn: { padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#0284c7', borderRadius: 10 },
  secondaryBtnText: { color: '#0284c7', fontWeight: '600' },
  meta: { marginTop: 8, color: '#64748b' },
  primary: { marginTop: 24, backgroundColor: '#dc2626', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});
