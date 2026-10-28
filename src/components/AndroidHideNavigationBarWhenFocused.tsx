import { useFocusEffect } from '@react-navigation/native';
import { NavigationBar } from 'expo-navigation-bar';
import React, { useCallback, useState } from 'react';
import { Platform } from 'react-native';

type Props = {
  /** When true and this screen is focused, hide the Android system navigation bar. */
  active: boolean;
};

/**
 * Hides the Android gesture / 3-button nav bar while the current screen is focused
 * (restores automatically on blur or unmount via NavigationBar stack).
 */
export function AndroidHideNavigationBarWhenFocused({ active }: Props) {
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  if (Platform.OS !== 'android' || !focused || !active) {
    return null;
  }

  return <NavigationBar hidden style="dark" />;
}
