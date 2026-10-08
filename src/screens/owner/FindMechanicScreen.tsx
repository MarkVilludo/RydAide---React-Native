import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import { searchMechanics, type MechanicResult } from '../../api/mechanics';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'FindMechanic'>;

/** Manual directory browse — does not dispatch help-request waves. */
export function FindMechanicScreen(_props: Props) {
  const emergency = false;
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MechanicResult[]>([]);
  const [searched, setSearched] = useState(false);

  const runSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Allow location to find nearby mechanics.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const mechanics = await searchMechanics({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        emergency,
      });
      setResults(mechanics);
    } catch (error) {
      Alert.alert('Search failed', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>Browse mechanics for planned service. This does not use your help-request allowance until you book.</Text>

      <Pressable style={styles.primary} onPress={runSearch} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Search nearby mechanics</Text>
        )}
      </Pressable>

      <Text style={styles.note}>Use NEED HELP on the home screen for stranded / emergency dispatch.</Text>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        style={{ marginTop: 16 }}
        ListEmptyComponent={
          searched && !loading ? (
            <Text style={styles.empty}>
              No mechanics found nearby. Run database seed on the API or widen search later.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.business_name}</Text>
            {item.mechanic_name && <Text style={styles.meta}>{item.mechanic_name}</Text>}
            <Text style={styles.meta}>
              {item.distance_km != null ? `${item.distance_km} km away · ` : ''}
              ★ {item.rating_average} ({item.rating_count})
            </Text>
            {item.emergency_available && <Text style={styles.badge}>Emergency available</Text>}
            {item.phone && <Text style={styles.phone}>{item.phone}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  intro: { color: '#475569', marginBottom: 16 },
  primary: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  note: { fontSize: 12, color: '#64748b', marginTop: 12 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  name: { fontSize: 17, fontWeight: '600' },
  meta: { color: '#64748b', marginTop: 4 },
  badge: { color: '#dc2626', fontWeight: '600', marginTop: 6 },
  phone: { marginTop: 8, color: '#0284c7' },
});
