import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';

/** One pulsing placeholder bar. */
export function SkeletonBlock({
  width = '100%',
  height = 14,
  radius = radii.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.border, opacity }, style]} />;
}

/** List-shaped placeholder (cards with a title + two lines) while the first page loads. */
export function LoadingSkeleton({ rows = 3, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.card}>
          <SkeletonBlock width="55%" height={16} />
          <SkeletonBlock width="85%" style={styles.line} />
          <SkeletonBlock width="40%" style={styles.line} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  line: { marginTop: spacing.sm + 2 },
});
