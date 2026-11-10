import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import { searchShops, type Shop } from '../../api/shops';
import { DirectoryRadiusMap } from '../../components/DirectoryRadiusMap';
import { DirectorySearchEmptyState } from '../../components/DirectorySearchEmptyState';
import { directoryBrowseStyles } from '../../components/directoryBrowseStyles';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { MapSearchOverlay } from '../../components/MapSearchOverlay';
import {
  SEARCH_RADIUS_MAX_KM,
  SEARCH_RADIUS_MIN_KM,
  SearchRadiusSelector,
} from '../../components/SearchRadiusSelector';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useDirectoryMapSearch } from '../../hooks/useDirectoryMapSearch';
import type { OwnerStackParamList } from '../../navigation/types';
import type { MapDirectoryPin } from '../../types/mapPins';
import { DirectoryListingActions } from '../../components/DirectoryListingActions';
import {
  formatDirectoryRating,
  formatDistanceKm,
  joinMetaParts,
  mapPinSnippetForShop,
} from '../../utils/directoryListing';
import { openDirections } from '../../utils/mapsLinks';

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

  const performSearch = useCallback(async (center: { latitude: number; longitude: number }, radius_km: number) => {
    const { shops, search } = await searchShops({
      latitude: center.latitude,
      longitude: center.longitude,
      radius_km,
    });
    return { results: shops, search };
  }, []);

  const {
    center,
    setCenter,
    locating,
    goToMyLocation,
    loading,
    results,
    searchMeta,
    searched,
    refreshing,
    onRefreshList,
  } = useDirectoryMapSearch<Shop>({
    radiusKm,
    locationDeniedMessage: 'Allow location to find nearby shops.',
    performSearch,
  });

  const mapPins = useMemo((): MapDirectoryPin[] => {
    if (!searched || loading) return [];

    return results
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({
        id: s.id,
        latitude: s.latitude!,
        longitude: s.longitude!,
        title: s.name,
        snippet: mapPinSnippetForShop(s),
        markerKeyPrefix: 'shop',
      }));
  }, [results, searched, loading]);

  const countLabel =
    loading && !searched
      ? 'Getting your location…'
      : loading
        ? 'Updating results…'
        : searched && searchMeta
          ? `${results.length} shop${results.length === 1 ? '' : 's'} within ${searchMeta.applied_radius_km} km${
              searchMeta.radius_expanded ? ` (expanded from ${searchMeta.requested_radius_km} km)` : ''
            }`
          : 'Set location to search';

  return (
    <View style={directoryBrowseStyles.root}>
      <View style={directoryBrowseStyles.mapSection}>
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
          message={locating ? 'Locating you…' : 'Searching shops'}
          submessage={!locating && center ? `Within ${radiusKm} km` : undefined}
        />
      </View>

      <View style={directoryBrowseStyles.sheetArea}>
        <GrabStyleBottomSheet>
          <Text style={directoryBrowseStyles.sheetTitle}>Shops near you</Text>
          <Text style={directoryBrowseStyles.count}>{countLabel}</Text>
          <Text style={styles.hint}>
            Only verified shops inside the circle are listed. Move the pin or change radius to refine results.
          </Text>

          <SearchRadiusSelector
            valueKm={radiusKm}
            onChangeKm={setRadiusKm}
            minKm={minRadius}
            maxKm={maxRadius}
            radiusOptionsKm={config?.directory.radius_options_km}
          />

          {searched && !loading && searchMeta && results.length < searchMeta.min_results_target &&
            searchMeta.recommended_radius_km > searchMeta.applied_radius_km && (
              <Pressable onPress={() => setRadiusKm(searchMeta.recommended_radius_km)}>
                <Text style={directoryBrowseStyles.recommend}>
                  Widen to {searchMeta.recommended_radius_km} km for more shops
                </Text>
              </Pressable>
            )}
        </GrabStyleBottomSheet>
      </View>

      <FlatList
        style={directoryBrowseStyles.list}
        contentContainerStyle={directoryBrowseStyles.listContent}
        data={loading ? [] : results}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RydAidRefreshControl refreshing={refreshing} onRefresh={() => void onRefreshList()} title="Pull to refresh" />
        }
        ListEmptyComponent={
          searched && !loading ? (
            <DirectorySearchEmptyState
              kind="shop"
              emergencyAssistanceEnabled={false}
              searchMeta={searchMeta}
              onWidenRadius={setRadiusKm}
            />
          ) : undefined
        }
      renderItem={({ item }) => {
        const canDirections = item.latitude != null && item.longitude != null;
        return (
          <View style={styles.card}>
            <Pressable
              style={({ pressed }) => [pressed && styles.cardPressed]}
              onPress={() => {
                if (canDirections) {
                  openDirections(item.latitude!, item.longitude!);
                }
              }}
              disabled={!canDirections}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}. ${canDirections ? 'Tap for directions.' : ''}`}
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {joinMetaParts([
                  formatDistanceKm(item.distance_km),
                  formatDirectoryRating(item.rating_average, item.rating_count),
                ]) || 'In your search area'}
              </Text>
              {(item.address || item.city) && (
                <Text style={styles.meta}>{[item.address, item.city].filter(Boolean).join(', ')}</Text>
              )}
              {item.mobile_service ? <Text style={styles.badge}>Mobile service</Text> : null}
              {canDirections ? <Text style={styles.tapHint}>Tap for directions</Text> : null}
            </Pressable>
            <DirectoryListingActions phone={item.phone} latitude={item.latitude} longitude={item.longitude} />
          </View>
        );
      }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: '#64748b', fontSize: 13, lineHeight: 18, marginBottom: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardPressed: { opacity: 0.92 },
  name: { fontSize: 17, fontWeight: '600' },
  meta: { color: '#64748b', marginTop: 4 },
  badge: { color: '#0369a1', fontWeight: '600', marginTop: 6 },
  tapHint: { color: '#0284c7', marginTop: 8, fontSize: 13, fontWeight: '600' },
});
