import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import {
  fetchMakes,
  fetchModels,
  fetchVariants,
  fetchVehicleTypes,
  fetchYears,
  type CatalogItem,
} from '../../api/catalog';
import { getApiErrorMessage } from '../../api/client';
import { createVehicle } from '../../api/vehicles';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'AddVehicle'>;

export function AddVehicleScreen({ navigation }: Props) {
  const [types, setTypes] = useState<CatalogItem[]>([]);
  const [makes, setMakes] = useState<CatalogItem[]>([]);
  const [models, setModels] = useState<CatalogItem[]>([]);
  const [variants, setVariants] = useState<CatalogItem[]>([]);
  const [years, setYears] = useState<number[]>([]);

  const [typeId, setTypeId] = useState<number | null>(null);
  const [makeId, setMakeId] = useState<number | null>(null);
  const [modelId, setModelId] = useState<number | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [nickname, setNickname] = useState('');
  const [mileage, setMileage] = useState('0');
  const [plate, setPlate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVehicleTypes().then((t) => {
      setTypes(t);
      if (t[0]) setTypeId(t[0].id);
    });
  }, []);

  useEffect(() => {
    if (!typeId) return;
    setMakeId(null);
    setModelId(null);
    setVariantId(null);
    setYear(null);
    fetchMakes(typeId).then(setMakes);
  }, [typeId]);

  useEffect(() => {
    if (!makeId) return;
    setModelId(null);
    setVariantId(null);
    setYear(null);
    fetchModels(makeId).then(setModels);
  }, [makeId]);

  useEffect(() => {
    if (!modelId) return;
    setVariantId(null);
    setYear(null);
    fetchVariants(modelId).then(setVariants);
  }, [modelId]);

  useEffect(() => {
    if (!variantId) return;
    setYear(null);
    fetchYears(variantId).then(setYears);
  }, [variantId]);

  const onSubmit = async () => {
    if (!typeId || !makeId || !modelId) {
      Alert.alert('Missing fields', 'Select type, make, and model.');
      return;
    }
    setSubmitting(true);
    try {
      await createVehicle({
        vehicle_type_id: typeId,
        vehicle_make_id: makeId,
        vehicle_model_id: modelId,
        vehicle_variant_id: variantId ?? undefined,
        year: year ?? undefined,
        current_mileage: parseInt(mileage, 10) || 0,
        nickname: nickname || undefined,
        plate_number: plate || undefined,
      });
      navigation.navigate('MyVehicles');
    } catch (error) {
      Alert.alert('Could not add vehicle', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.label}>Vehicle type</Text>
      <PickerRow items={types} selectedId={typeId} onSelect={setTypeId} />

      <Text style={styles.label}>Make</Text>
      <PickerRow items={makes} selectedId={makeId} onSelect={setMakeId} />

      <Text style={styles.label}>Model</Text>
      <PickerRow items={models} selectedId={modelId} onSelect={setModelId} />

      {variants.length > 0 && (
        <>
          <Text style={styles.label}>Variant</Text>
          <PickerRow items={variants} selectedId={variantId} onSelect={setVariantId} />
        </>
      )}

      {years.length > 0 && (
        <>
          <Text style={styles.label}>Year</Text>
          <View style={styles.chipRow}>
            {years.map((y) => (
              <Pressable
                key={y}
                style={[styles.chip, year === y && styles.chipActive]}
                onPress={() => setYear(y)}
              >
                <Text style={year === y ? styles.chipTextActive : styles.chipText}>{y}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.label}>Nickname</Text>
      <TextInput style={styles.input} placeholder="Daily ride" value={nickname} onChangeText={setNickname} />

      <Text style={styles.label}>Current mileage (km)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={mileage}
        onChangeText={setMileage}
      />

      <Text style={styles.label}>Plate number</Text>
      <TextInput style={styles.input} value={plate} onChangeText={setPlate} autoCapitalize="characters" />

      <Pressable style={styles.primary} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save vehicle</Text>}
      </Pressable>
    </ScrollView>
  );
}

function PickerRow({
  items,
  selectedId,
  onSelect,
}: {
  items: CatalogItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.chip, selectedId === item.id && styles.chipActive]}
          onPress={() => onSelect(item.id)}
        >
          <Text style={selectedId === item.id ? styles.chipTextActive : styles.chipText}>{item.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  chipText: { color: '#334155' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  primary: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
});
