import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { DirectorySearchMeta } from '../../api/appConfig';
import { searchMechanics, type MechanicResult } from '../../api/mechanics';
import { DirectoryRadiusMap, type SearchCenter } from '../../components/DirectoryRadiusMap';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { MapSearchOverlay } from '../../components/MapSearchOverlay';
import {
  SEARCH_RADIUS_MAX_KM,
  SEARCH_RADIUS_MIN_KM,
  SearchRadiusSelector,
} from '../../components/SearchRadiusSelector';
import { useAppConfig } from '../../hooks/useAppConfig';
import { ensureDevNearbyDataBeforeSearch } from '../../utils/ensureDevNearbyData';
import type { OwnerStackParamList } from '../../navigation/types';
import type { MapDirectoryPin } from '../../types/mapPins';

type Props = NativeStackScreenProps<OwnerStackParamList, 'FindMechanic'>;

/** Directory browse — live search like ride-hail “vehicles nearby”. */
export function FindMechanicScreen({ navigation }: Props) {
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
  const [locating, setLocating] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MechanicResult[]>([]);
  const [searchMeta, setSearchMeta] = useState<DirectorySearchMeta | null>(null);
  const [searched, setSearched] = useState(false);
  const searchGen = useRef(0);

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

  const runSearch = useCallback(async () => {
    if (!center) return;
    const gen = ++searchGen.current;
    setLoading(true);
    setSearched(true);
    try {
      await ensureDevNearbyDataBeforeSearch(
        config?.features.dynamic_nearby_seed === true,
        center.latitude,
        center.longitude,
      );
      const { mechanics, search } = await searchMechanics({
        latitude: center.latitude,
        longitude: center.longitude,
        emergency,
        radius_km: radiusKm,
      });
      if (gen !== searchGen.current) return;
      setResults(mechanics);
      setSearchMeta(search);
    } catch (error) {
      if (gen === searchGen.current) {
        Alert.alert('Search failed', getApiErrorMessage(error));
      }
    } finally {
      if (gen === searchGen.current) setLoading(false);
    }
  }, [center, config?.features.dynamic_nearby_seed, emergency, radiusKm]);

  useEffect(() => {
    if (!center || locating) return;
    const timer = setTimeout(() => {
      runSearch();
    }, 450);
    return () => clearTimeout(timer);
  }, [center, radiusKm, locating, runSearch]);

  const mapPins = useMemo((): MapDirectoryPin[] => {
    if (!searched || loading) return [];

    return results
      .filter((m) => m.latitude != null && m.longitude != null)
      .map((m) => ({
        id: m.id,
        latitude: m.latitude!,
        longitude: m.longitude!,
        title: 'Available',
        snippet: m.distance_km != null ? `${m.distance_km} km` : undefined,
        markerKeyPrefix: 'mechanic',
      }));
  }, [results, searched, loading]);

  const countLabel =
    loading && !searched
      ? 'Getting your location…'
      : loading
        ? 'Updating results…'
        : searched && searchMeta
          ? `${results.length} mechanic${results.length === 1 ? '' : 's'} within ${searchMeta.applied_radius_km} km`
          : 'Set location to search';

  return (
    <View style={styles.root}>
      <View style={styles.mapSection}>
        <DirectoryRadiusMap
          center={center}
          radiusKm={radiusKm}
          pins={mapPins}
          onCenterChange={setCenter}
          onUseMyLocation={goToMyLocation}
          locating={locating}
        />
        <MapSearchOverlay
          visible={loading || locating}
          message={locating ? 'Locating you…' : 'Searching mechanics'}
          submessage={!locating && center ? `Within ${radiusKm} km` : undefined}
        />
      </View>

      <View style={styles.sheetArea}>
        <GrabStyleBottomSheet>
          <Text style={styles.sheetTitle}>Mechanics near you</Text>
          <Text style={styles.count}>{countLabel}</Text>

          <SearchRadiusSelector
            valueKm={radiusKm}
            onChangeKm={setRadiusKm}
            minKm={minRadius}
            maxKm={maxRadius}
            radiusOptionsKm={config?.directory.radius_options_km}
          />

          {config?.features.emergency_assistance && (
            <>
              <Pressable
                style={styles.helpCta}
                onPress={() =>
                  navigation.navigate('NeedHelp', {
                    emergency: true,
                    latitude: center?.latitude,
                    longitude: center?.longitude,
                  })
                }
              >
                <Text style={styles.helpCtaTitle}>Request roadside help</Text>
                <Text style={styles.helpCtaSub}>
                  Pick your vehicle, problem, and location — we dispatch verified mechanics near you.
                </Text>
              </Pressable>
              <Pressable
                style={styles.serviceCta}
                onPress={() =>
                  navigation.navigate('NeedHelp', {
                    emergency: false,
                    latitude: center?.latitude,
                    longitude: center?.longitude,
                  })
                }
              >
                <Text style={styles.serviceCtaText}>Schedule non-emergency service</Text>
              </Pressable>
            </>
          )}

          {searched && !loading && searchMeta && results.length < searchMeta.min_results_target &&
            searchMeta.recommended_radius_km > searchMeta.applied_radius_km && (
              <Pressable onPress={() => setRadiusKm(searchMeta.recommended_radius_km)}>
                <Text style={styles.recommend}>
                  Widen to {searchMeta.recommended_radius_km} km for more results
                </Text>
              </Pressable>
            )}
        </GrabStyleBottomSheet>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={loading ? [] : results}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          searched && !loading ? (
            <Text style={styles.empty}>
              No verified mechanics in this area yet. Try a larger radius or request help to broadcast
              to more providers.
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.dot} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Provider #{index + 1}</Text>
                <Text style={styles.cardMeta}>
                  {item.distance_km != null ? `${item.distance_km} km away` : 'In your search area'}
                  {item.emergency_available ? ' · Emergency OK' : ''}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e2e8f0' },
  mapSection: { height: 300, position: 'relative' },
  sheetArea: { zIndex: 2 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  count: { fontSize: 15, color: '#0284c7', fontWeight: '600', marginTop: 4, marginBottom: 8 },
  helpCta: {
    marginTop: 16,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
  },
  helpCtaTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  helpCtaSub: { color: '#94a3b8', fontSize: 13, marginTop: 6, lineHeight: 18 },
  serviceCta: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  serviceCtaText: { color: '#0284c7', fontWeight: '600', fontSize: 14 },
  recommend: { color: '#0284c7', fontWeight: '600', marginTop: 12 },
  list: { flex: 1, backgroundColor: '#f8fafc' },
  listContent: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: '#64748b', lineHeight: 20, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardMeta: { color: '#64748b', marginTop: 2, fontSize: 14 },
});
