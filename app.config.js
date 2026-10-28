const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'RydAidMobile',
  slug: 'RydAidMobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'RydAid uses your location to find nearby mechanics.',
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    usesCleartextTraffic: true,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'RydAid uses your location to find nearby mechanics.',
      },
    ],
    'expo-status-bar',
    'expo-maps',
  ],
};

if (googleMapsApiKey) {
  config.ios.config = { googleMapsApiKey };
  config.android.config = {
    googleMaps: { apiKey: googleMapsApiKey },
  };
}

export default config;
