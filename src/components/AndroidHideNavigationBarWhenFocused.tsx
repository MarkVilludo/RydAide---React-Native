import { useFocusEffect } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import React, { useCallback } from 'react';
import { Platform } from 'react-native';

type Props = {
  /** When true and this screen is focused, hide the Android system navigation bar. */
  active: boolean;
};

/** Hides the Android nav bar while this screen is focused; restores on blur. */
export function AndroidHideNavigationBarWhenFocused({ active }: Props) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !active) {
        return;
      }
      void NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      return () => {
        void NavigationBar.setVisibilityAsync('visible').catch(() => {});
      };
    }, [active]),
  );

  return null;
}
