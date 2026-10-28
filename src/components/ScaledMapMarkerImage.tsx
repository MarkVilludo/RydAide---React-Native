import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';

type Props = {
  source: ImageSourcePropType;
  size: number;
};

/** Geo-anchored marker bitmap for react-native-maps (size in density-independent pixels). */
export function ScaledMapMarkerImage({ source, size }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} collapsable={false}>
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
