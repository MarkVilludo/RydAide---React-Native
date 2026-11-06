const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

const iosBundleId = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID?.trim() || 'com.rydaid.mobile';
const androidPackage = process.env.EXPO_PUBLIC_ANDROID_PACKAGE?.trim() || 'com.rydaid.mobile';
const mechanicProProductId =
  process.env.EXPO_PUBLIC_MECHANIC_PRO_PRODUCT_ID?.trim() || 'com.rydaid.mechanic.pro.monthly';

/** Linked on expo.dev — override with EXPO_PUBLIC_EAS_PROJECT_ID in .env if needed */
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || '579d9891-5bb8-4e2b-b4f0-975570d3d60e';

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'RydAid',
  slug: 'rydaid-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#f8fafc',
  },
  userInterfaceStyle: 'light',
  ios: {
    icon: './assets/icon.png',
    supportsTablet: true,
    bundleIdentifier: iosBundleId,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'RydAid uses your location to find nearby mechanics.',
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    icon: './assets/icon.png',
    package: androidPackage,
    softwareKeyboardLayoutMode: 'resize',
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
  extra: {
    eas: {
      projectId: easProjectId,
    },
    storeBilling: {
      mechanicProProductId,
      iosBundleId,
      androidPackage,
      sandbox: process.env.EXPO_PUBLIC_STORE_SANDBOX === 'true',
    },
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0284c7',
        defaultChannel: 'help-requests',
      },
    ],
    'expo-secure-store',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'RydAid uses your location to find nearby mechanics.',
      },
    ],
    'expo-status-bar',
    'expo-navigation-bar',
    'expo-maps',
    'expo-iap',
  ],
};

if (googleMapsApiKey) {
  config.ios.config = { googleMapsApiKey };
  config.android.config = {
    googleMaps: { apiKey: googleMapsApiKey },
  };
}

export default config;
