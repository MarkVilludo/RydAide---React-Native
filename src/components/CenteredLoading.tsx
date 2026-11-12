import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  message?: string;
  /** Fill the parent (default). Pass false for inline use inside a fixed-height area. */
  fill?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Full-viewport (or fill) centered spinner — use instead of marginTop-offset indicators. */
export function CenteredLoading({
  message,
  fill = true,
  color = '#0284c7',
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get('window').height;

  const fillStyle = useMemo(
    () => [
      styles.fill,
      {
        minHeight: Math.max(240, windowHeight - insets.top - insets.bottom),
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      },
      style,
    ],
    [insets.bottom, insets.top, style, windowHeight],
  );

  return (
    <View
      style={fill ? fillStyle : [styles.inline, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
    >
      <ActivityIndicator size="large" color={color} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
    paddingHorizontal: 24,
  },
  inline: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
  },
});
