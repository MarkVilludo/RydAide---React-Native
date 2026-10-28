import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { homeIndicatorBottomInset } from '../utils/screenInsets';

const TOAST_MS = 4200;

let showToastImpl: ((message: string) => void) | null = null;

/** Brief non-blocking message (toast on Android; banner on iOS). */
export function showAppToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
    return;
  }
  showToastImpl?.(message);
}

export function AppToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setMessage(null);
    });
  }, [opacity]);

  const show = useCallback(
    (text: string) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      setMessage(text);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(hide, TOAST_MS);
    },
    [hide, opacity],
  );

  useEffect(() => {
    showToastImpl = show;
    return () => {
      showToastImpl = null;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [show]);

  if (Platform.OS === 'android' || !message) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.host, { bottom: homeIndicatorBottomInset() + 16 }]}>
      <Animated.View style={[styles.banner, { opacity }]}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  banner: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: '100%',
  },
  text: { color: '#f8fafc', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
});
