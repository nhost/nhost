import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Nhost Starter',
  slug: 'nhost-starter',
  version: '0.1.0',
  scheme: 'nhost-starter',
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: 'io.nhost.starter',
    supportsTablet: true,
  },
  android: {
    package: 'io.nhost.starter',
    // Keystore keys never leave the device, so a restored backup would carry
    // session values nothing can decrypt.
    allowBackup: false,
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#1d1d1d' }],
    // The session is kept without biometrics, so the app never asks for Face ID.
    ['expo-secure-store', { faceIDPermission: false }],
  ],
});
