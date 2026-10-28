import React, { useCallback, useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import type { MapMarkerRoleConfig } from '../api/appConfig';
import { MAP_MARKER_IMAGES } from '../constants/mapMarkerAssets';

type Props = {
  label: string;
  marker?: MapMarkerRoleConfig | null;
  fallbackColor: string;
  compact?: boolean;
  /** customer | mechanic — bundled PNG when remote icon fails or is missing */
  role?: 'customer' | 'mechanic';
  /** Call when icon (remote or bundled) has finished layout — for map snapshot timing */
  onMarkerReady?: () => void;
};

export function MapMarkerPin({
  label,
  marker,
  fallbackColor,
  compact = false,
  role = 'customer',
  onMarkerReady,
}: Props) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const color = marker?.pin_color ?? fallbackColor;
  const iconUrl = marker?.icon_url;
  const bundledSource = MAP_MARKER_IMAGES[role];
  const useRemote = !!iconUrl && !remoteFailed;
  const imageSource: ImageSourcePropType = useRemote ? { uri: iconUrl } : bundledSource;

  const notifyReady = useCallback(() => {
    onMarkerReady?.();
  }, [onMarkerReady]);

  useEffect(() => {
    setRemoteFailed(false);
  }, [iconUrl]);

  const onImageLoadEnd = () => {
    notifyReady();
  };

  const onImageError = () => {
    setRemoteFailed(true);
    notifyReady();
  };

  if (compact) {
    return (
      <View style={styles.compactGroup}>
        <View style={styles.compactPlate}>
          <Image
            source={imageSource}
            style={styles.compactImage}
            onLoad={onImageLoadEnd}
            onError={onImageError}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.compactLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.column} collapsable={false}>
      <View style={[styles.tag, { backgroundColor: color }]}>
        <Text style={styles.tagText} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.iconPlate}>
        <Image
          source={imageSource}
          style={styles.pinImage}
          onLoad={onImageLoadEnd}
          onError={onImageError}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', width: 96 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    maxWidth: 96,
  },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  iconPlate: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinImage: { width: 44, height: 44 },
  compactPlate: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  compactGroup: { alignItems: 'center', width: 72 },
  compactImage: { width: 26, height: 26, marginBottom: 0 },
});
