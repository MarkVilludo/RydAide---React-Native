import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { searchShops, type Shop } from '../../api/shops';
import { DirectoryRadiusMap, type SearchCenter } from '../../components/DirectoryRadiusMap';
import {
  SEARCH_RADIUS_MAX_KM,
  SEARCH_RADIUS_MIN_KM,
  SearchRadiusSelector,
} from '../../components/SearchRadiusSelector';
import { useAppConfig } from '../../hooks/useAppConfig';
import { ensureDevNearbyDataBeforeSearch } from '../../utils/ensureDevNearbyData';
import type { OwnerStackParamList } from '../../navigation/types';
import type { MapDirectoryPin } from '../../types/mapPins';

type Props = NativeStackScreenProps<OwnerStackParamList, 'FindShop'>;

export function FindShopScreen(_props: Props) {
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
  const [results, setResults] = useState<Shop[]>([]);
  const [searchMeta, setSearchMeta] = useState<DirectorySearchMeta | null>(null);
  const [searched, setSearched] = useState(false);
  const ensureLocationPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location required', 'Allow location to find nearby shops.');
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

  const mapPins = useMemo((): MapDirectoryPin[] => {
    if (!searched) return [];

    return results
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({
        id: s.id,
        latitude: s.latitude!,
        longitude: s.longitude!,
        title: s.name,
        snippet: s.distance_km != null ? `${s.distance_km} km · ★ ${s.rating_average}` : undefined,
        markerKeyPrefix: 'shop',
      }));
  }, [results, searched]);

  const runSearch = async () => {
    if (!center) {
      Alert.alert('Pick a location', 'Tap the map or use My location.');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      await ensureDevNearbyDataBeforeSearch(
        config?.features.dynamic_nearby_seed === true,
        center.latitude,
        center.longitude,
      );
      const { shops, search } = await searchShops({
        latitude: center.latitude,
        longitude: center.longitude,
        radius_km: radiusKm,
      });
      setResults(shops);
      setSearchMeta(search);
    } catch (error) {
      Alert.alert('Search failed', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={styles.intro}>
        Set your search point and distance (from app settings). Only verified shops inside the circle are listed.
      </Text>

      <DirectoryRadiusMap
        center={center}
        radiusKm={radiusKm}
        pins={mapPins}
        onCenterChange={setCenter}
        onUseMyLocation={goToMyLocation}
        locating={locating}
      />

      <SearchRadiusSelector
        valueKm={radiusKm}
        onChangeKm={setRadiusKm}
        minKm={minRadius}
        maxKm={maxRadius}
        radiusOptionsKm={config?.directory.radius_options_km}
      />

      <Pressable style={styles.primary} onPress={runSearch} disabled={loading || !center}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Search shops in this area</Text>
        )}
      </Pressable>

      {searched && !loading && searchMeta ? (
        <Text style={styles.resultCount}>
          {results.length} shop{results.length === 1 ? '' : 's'} within {searchMeta.applied_radius_km} km
          {searchMeta.radius_expanded
            ? ` (expanded from ${searchMeta.requested_radius_km} km)`
            : ''}
          {results.length < searchMeta.min_results_target &&
          searchMeta.recommended_radius_km > searchMeta.applied_radius_km ? (
            <>
              {'\n'}
              <Text style={styles.recommend} onPress={() => setRadiusKm(searchMeta.recommended_radius_km)}>
                Try {searchMeta.recommended_radius_km} km for more shops
              </Text>
            </>
          ) : null}
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
            No verified shops in this radius yet. Try a larger distance or move the pin.
          </Text>
        ) : null
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {item.distance_km != null ? `${item.distance_km} km away · ` : ''}
            ★ {item.rating_average}
            {item.rating_count != null ? ` (${item.rating_count})` : ''}
          </Text>
          {(item.address || item.city) && (
            <Text style={styles.meta}>{[item.address, item.city].filter(Boolean).join(', ')}</Text>
          )}
          {item.mobile_service && <Text style={styles.badge}>Mobile service</Text>}
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
  resultCount: { fontWeight: '600', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  recommend: { color: '#0284c7', fontWeight: '600', marginTop: 6 },
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
  badge: { color: '#0369a1', fontWeight: '600', marginTop: 6 },
  phone: { marginTop: 8, color: '#0284c7' },
});
