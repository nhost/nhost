import * as SecureStore from 'expo-secure-store';

/**
 * Every key the app writes to SecureStore. SecureStore cannot list what it
 * holds, so a key missing here would survive the wipe on reinstall.
 */
export const DEVICE_KEYS = [
  'nhostPasswordReset',
  'nhostSignInAttempt',
  'nhostLastSignIn',
] as const;

export type DeviceKey = (typeof DEVICE_KEYS)[number];

/**
 * The options every SecureStore call passes. On iOS the keychain service and
 * authentication setting pick which item a key names, so a call with other
 * options could miss an item or write a second one beside it.
 */
export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** The value under `key`, or null when it is unset or cleared. */
export function getDeviceItem(key: DeviceKey): string | null {
  return SecureStore.getItem(key, SECURE_STORE_OPTIONS) || null;
}

export function setDeviceItem(key: DeviceKey, value: string): void {
  SecureStore.setItem(key, value, SECURE_STORE_OPTIONS);
}

/**
 * Clears `key` by writing ''. SecureStore's only delete is asynchronous and
 * could land after a later write to the same key.
 */
export function clearDeviceItem(key: DeviceKey): void {
  SecureStore.setItem(key, '', SECURE_STORE_OPTIONS);
}
