import React from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

const LOGO_HORIZONTAL = require('../../assets/brand/logo-horizontal.png');

type Props = {
  /** Width in px; height follows logo aspect ratio (~680:200). */
  width?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

export function BrandLogo({ width = 168, style, imageStyle, accessibilityLabel = 'RydAid' }: Props) {
  const height = Math.round((width * 200) / 680);
  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={LOGO_HORIZONTAL}
        style={[{ width, height }, imageStyle]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
