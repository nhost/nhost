import type { ConfigContext, ExpoConfig } from 'expo/config';

// The one read of the environment outside `src/lib/nhost/env.ts`: iOS only
// offers passkeys for a domain the app's entitlements name, which are fixed at
// build time.
function passkeyEntitlements(): NonNullable<ExpoConfig['ios']> {
  const domain = process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;
  return domain ? { associatedDomains: [`webcredentials:${domain}`] } : {};
}

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
    ...passkeyEntitlements(),
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
    // Avatars come from the photo library only, so the camera and microphone
    // permissions are blocked rather than left to the plugin's defaults.
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow $(PRODUCT_NAME) to use a photo from your library as your avatar.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
});
