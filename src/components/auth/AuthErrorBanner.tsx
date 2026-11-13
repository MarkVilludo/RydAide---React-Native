import React from 'react';
import { Text, View } from 'react-native';
import { authStyles } from './AuthLayout';

/** Inline form-level error inside the auth card (replaces a blocking alert). */
export function AuthErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={authStyles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text style={authStyles.bannerText}>{message}</Text>
    </View>
  );
}
