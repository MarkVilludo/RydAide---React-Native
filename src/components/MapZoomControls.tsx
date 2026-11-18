import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, touch } from '../theme/tokens';

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Extra offset from bottom (e.g. above a sheet). */
  bottomInset?: number;
};

export function MapZoomControls({ onZoomIn, onZoomOut, bottomInset = 16 }: Props) {
  return (
    <View style={[styles.column, { bottom: bottomInset }]} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={onZoomIn}
        accessibilityRole="button"
        accessibilityLabel="Zoom in"
      >
        <Text style={styles.glyph}>+</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnBottom, pressed && styles.btnPressed]}
        onPress={onZoomOut}
        accessibilityRole="button"
        accessibilityLabel="Zoom out"
      >
        <Text style={styles.glyph}>−</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    right: 12,
    gap: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  btn: {
    width: touch.min,
    height: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
  },
  btnBottom: {
    borderTopWidth: 0,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  btnPressed: { opacity: 0.88, backgroundColor: colors.primarySoft },
  glyph: { fontSize: 22, fontWeight: '700', color: colors.text, lineHeight: 24 },
});