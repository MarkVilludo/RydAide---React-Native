import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
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
import { DirectoryRadiusMap, type SearchCenter } from '../../components/DirectoryRadiusMap';
import {
  SEARCH_RADIUS_MAX_KM,
  SEARCH_RADIUS_MIN_KM,
  SearchRadiusSelector,
} from '../../components/SearchRadiusSelector';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'FindMechanic'>;

/** Manual directory browse — does not dispatch help-request waves. */
export function FindMechanicScreen(_props: Props) {
  const emergency = false;
  const { config } = useAppConfig();
  const minRadius = config?.directory.min_radius_km ?? SEARCH_RADIUS_MIN_KM;
  const maxRadius = config?.directory.max_radius_km ?? SEARCH_RADIUS_MAX_KM;
  const defaultRadius = Math.min(
    maxRadius,
    Math.max(minRadius, config?.directory.default_radius_km ?? 5),
  );
  const [radiusKm, setRadiusKm] = useState(defaultRadius);
  const [center, setCenter] = useState<SearchCenter | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MechanicResult[]>([]);
  const [searched, setSearched] = useState(false);

  const ensureLocationPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location required', 'Allow location to find nearby mechanics.');
      return false;
    }
    return true;
  }, []);

  const goToMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      if (!(await ensureLocationPermission())) {
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCenter({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      Alert.alert('Location error', 'Could not read GPS. Tap the map to pick a spot.');
    } finally {
      setLocating(false);
    }
  }, [ensureLocationPermission]);

  useEffect(() => {
    goToMyLocation();
  }, [goToMyLocation]);

  const runSearch = async () => {
    if (!center) {
      Alert.alert('Pick a location', 'Tap the map, drag the pin, or use My location.');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const mechanics = await searchMechanics({
        latitude: center.latitude,
        longitude: center.longitude,
        emergency,
        radius_km: radiusKm,
      });
      setResults(mechanics);
    } catch (error) {
      Alert.alert('Search failed', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={styles.intro}>
        Set your search point on the map and choose a radius. Only verified mechanics inside the circle are listed.
      </Text>

      <DirectoryRadiusMap
        center={center}
        radiusKm={radiusKm}
        mechanics={searched ? results : []}
        onCenterChange={setCenter}
        onUseMyLocation={goToMyLocation}
        locating={locating}
      />

      <SearchRadiusSelector
        valueKm={radiusKm}
        onChangeKm={setRadiusKm}
        minKm={minRadius}
        maxKm={maxRadius}
      />

      <Pressable style={styles.primary} onPress={runSearch} disabled={loading || !center}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Search mechanics in this area</Text>
        )}
      </Pressable>

      {config?.features.emergency_assistance ? (
        <Text style={styles.note}>Use NEED HELP on the home screen for stranded / emergency dispatch.</Text>
      ) : null}

      {searched && !loading ? (
        <Text style={styles.resultCount}>
          {results.length} mechanic{results.length === 1 ? '' : 's'} in {radiusKm} km
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={results}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        searched && !loading ? (
          <Text style={styles.empty}>
            No verified mechanics in this radius yet. Widen the circle or move the pin to another area.
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  headerBlock: { gap: 0 },
  intro: { color: '#475569', marginBottom: 12 },
  primary: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  note: { fontSize: 12, color: '#64748b', marginTop: 12 },
  resultCount: { fontWeight: '600', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 8 },
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
