import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import { fetchActiveHelpRequest } from '../../api/helpRequests';
import { searchMechanics, type MechanicResult } from '../../api/mechanics';
import { isOwnerLiveHelpRequest } from '../../utils/helpRequestStatus';
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
import {
  availabilityDotColor,
  availabilityLabel,
  mapPinSnippetForMechanic,
  mechanicListingMetaLine,
} from '../../utils/directoryListing';
import { openDirections } from '../../utils/mapsLinks';

type Props = NativeStackScreenProps<OwnerStackParamList, 'FindMechanic'>;

/** Directory browse — live search like ride-hail “vehicles nearby”. */
export function FindMechanicScreen({ navigation }: Props) {
  const emergency = false;
  const { config } = useAppConfig();
  const emergencyOn = config?.features?.emergency_assistance ?? false;
  const minRadius = config?.directory.min_radius_km ?? SEARCH_RADIUS_MIN_KM;
  const maxRadius = config?.directory.max_radius_km ?? SEARCH_RADIUS_MAX_KM;
  const defaultRadius = Math.min(
    maxRadius,
    Math.max(minRadius, config?.directory.default_radius_km ?? 5),
  );
  const [radiusKm, setRadiusKm] = useState(defaultRadius);

  const performSearch = useCallback(
    async (center: { latitude: number; longitude: number }, radius_km: number) => {
      const { mechanics, search } = await searchMechanics({
        latitude: center.latitude,
        longitude: center.longitude,
        emergency,
        radius_km,
      });
      return { results: mechanics, search };
    },
    [emergency],
  );

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
  } = useDirectoryMapSearch<MechanicResult>({
    radiusKm,
    locationDeniedMessage: 'Allow location to find nearby mechanics.',
    performSearch,
  });

  const mapPins = useMemo((): MapDirectoryPin[] => {
    if (!searched || loading) return [];

    return results
      .filter((m) => m.latitude != null && m.longitude != null)
      .map((m) => ({
        id: m.id,
        latitude: m.latitude!,
        longitude: m.longitude!,
        title: availabilityLabel(m.availability_status),
        snippet: mapPinSnippetForMechanic(m),
        markerKeyPrefix: 'mechanic',
      }));
  }, [results, searched, loading]);

  const countLabel =
    loading && !searched
      ? 'Getting your location…'
      : loading
        ? 'Updating…'
        : searched && searchMeta
          ? `${results.length} within ${searchMeta.applied_radius_km} km`
          : 'Move the map to search';

  const needHelpLatitude = center?.latitude;
  const needHelpLongitude = center?.longitude;

  const startNeedHelp = useCallback(
    async (asEmergency: boolean) => {
      try {
        const active = await fetchActiveHelpRequest();
        if (active && isOwnerLiveHelpRequest(active)) {
          Alert.alert(
            'Active request in progress',
            'You already have an active help request. Finish or cancel it before booking another service.',
            [
              { text: 'OK', style: 'cancel' },
              {
                text: 'Open request',
                onPress: () =>
                  navigation.navigate('ActiveHelpRequest', { helpRequestId: active.id }),
              },
            ],
          );
          return;
        }
      } catch {
        /* API still enforces on submit */
      }
      navigation.navigate('NeedHelp', {
        emergency: asEmergency,
        latitude: needHelpLatitude,
        longitude: needHelpLongitude,
      });
    },
    [navigation, needHelpLatitude, needHelpLongitude],
  );

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
          message={locating ? 'Locating you…' : 'Searching mechanics'}
          submessage={!locating && center ? `Within ${radiusKm} km` : undefined}
        />
      </View>

      <View style={directoryBrowseStyles.sheetArea}>
        <GrabStyleBottomSheet>
          <Text style={directoryBrowseStyles.sheetTitle}>Mechanics near you</Text>
          <Text style={directoryBrowseStyles.count}>{countLabel}</Text>

          <SearchRadiusSelector
            valueKm={radiusKm}
            onChangeKm={setRadiusKm}
            minKm={minRadius}
            maxKm={maxRadius}
            radiusOptionsKm={config?.directory.radius_options_km}
          />

          {emergencyOn && (
            <>
              <Pressable style={styles.helpCta} onPress={() => void startNeedHelp(true)}>
                <Text style={styles.helpCtaTitle}>Need help now?</Text>
                <Text style={styles.helpCtaSub}>We’ll notify verified mechanics near you.</Text>
              </Pressable>
              <Pressable style={styles.serviceCta} onPress={() => void startNeedHelp(false)}>
                <Text style={styles.serviceCtaText}>Book non-emergency service</Text>
              </Pressable>
            </>
          )}

          {searched && !loading && searchMeta && results.length < searchMeta.min_results_target &&
            searchMeta.recommended_radius_km > searchMeta.applied_radius_km && (
              <Pressable onPress={() => setRadiusKm(searchMeta.recommended_radius_km)}>
                <Text style={directoryBrowseStyles.recommend}>
                  Widen to {searchMeta.recommended_radius_km} km for more results
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
              kind="mechanic"
              emergencyAssistanceEnabled={emergencyOn}
              searchMeta={searchMeta}
              onWidenRadius={setRadiusKm}
              onRequestHelp={emergencyOn ? () => void startNeedHelp(true) : undefined}
            />
          ) : undefined
        }
        renderItem={({ item }) => {
          const canDirections = item.latitude != null && item.longitude != null;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => {
                if (canDirections) {
                  openDirections(item.latitude!, item.longitude!);
                }
              }}
              disabled={!canDirections}
              accessibilityRole="button"
              accessibilityLabel="Verified mobile mechanic. Tap for directions."
            >
              <View style={styles.cardRow}>
                <View style={[styles.dot, { backgroundColor: availabilityDotColor(item.availability_status) }]} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Verified mobile mechanic</Text>
                  <Text style={styles.cardMeta}>{mechanicListingMetaLine(item)}</Text>
                  {canDirections ? (
                    <Text style={styles.cardActionHint}>Tap for directions</Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardPressed: { backgroundColor: '#f8fafc' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardMeta: { color: '#64748b', marginTop: 2, fontSize: 14, lineHeight: 20 },
  cardActionHint: { color: '#0284c7', marginTop: 6, fontSize: 13, fontWeight: '600' },
});
