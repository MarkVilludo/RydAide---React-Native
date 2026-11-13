import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getApiErrorMessage } from '../api/client';
import type { DirectorySearchMeta } from '../api/appConfig';
type SearchCenter = { latitude: number; longitude: number };

type PerformSearch<T> = (
  center: SearchCenter,
  radiusKm: number,
) => Promise<{ results: T[]; search: DirectorySearchMeta }>;

type Options<T> = {
  radiusKm: number;
  locationDeniedMessage: string;
  performSearch: PerformSearch<T>;
  debounceMs?: number;
};

/** Shared map-pin directory browse: GPS center, debounced re-search on move/radius. */
export function useDirectoryMapSearch<T>({
  radiusKm,
  locationDeniedMessage,
  performSearch,
  debounceMs = 450,
}: Options<T>) {
  const [center, setCenter] = useState<SearchCenter | null>(null);
  const [locating, setLocating] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const [searchMeta, setSearchMeta] = useState<DirectorySearchMeta | null>(null);
  const [searched, setSearched] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchGen = useRef(0);

  const ensureLocationPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location required', locationDeniedMessage);
      return false;
    }
    return true;
  }, [locationDeniedMessage]);

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
    void goToMyLocation();
  }, [goToMyLocation]);

  const runSearch = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!center) return;
      const soft = opts?.soft === true;
      const gen = ++searchGen.current;
      if (!soft) {
        setLoading(true);
        setSearched(true);
      }
      try {
        const { results: next, search } = await performSearch(center, radiusKm);
        if (gen !== searchGen.current) return;
        setResults(next);
        setSearchMeta(search);
      } catch (error) {
        if (gen === searchGen.current) {
          Alert.alert('Search failed', getApiErrorMessage(error));
        }
      } finally {
        if (gen === searchGen.current && !soft) {
          setLoading(false);
        }
      }
    },
    [center, performSearch, radiusKm],
  );

  const onRefreshList = useCallback(async () => {
    if (!center) return;
    setRefreshing(true);
    try {
      await runSearch({ soft: true });
    } finally {
      setRefreshing(false);
    }
  }, [center, runSearch]);

  useEffect(() => {
    if (!center || locating) return;
    const timer = setTimeout(() => {
      void runSearch();
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [center, radiusKm, locating, runSearch, debounceMs]);

  return {
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
  };
}
