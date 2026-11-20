import * as SecureStore from 'expo-secure-store';

/** The app's own keys, read and written through this module. */
export const DEVICE_KEYS = [
  'nhostPasswordReset',
  'nhostSignInAttempt',
  'nhostLastSignIn',
] as const;

export type DeviceKey = (typeof DEVICE_KEYS)[number];

/** The session's header key. `lib/nhost/storage.ts` explains the layout. */
export const SESSION_KEY = 'nhostSession';

export const SESSION_SLOTS = ['a', 'b'] as const;

export type SessionSlot = (typeof SESSION_SLOTS)[number];

/** Chunks per slot: 8 KB, room for a session with large custom claims. */
export const MAX_SESSION_CHUNKS = 4;

export function sessionChunkKey(slot: SessionSlot, index: number): string {
  return `${SESSION_KEY}.${slot}.${index}`;
}

export const SESSION_CHUNK_KEYS: readonly string[] = SESSION_SLOTS.flatMap(
  (slot) =>
    Array.from({ length: MAX_SESSION_CHUNKS }, (_, index) =>
      sessionChunkKey(slot, index),
    ),
);

/**
 * Every key the app writes to SecureStore, the session header first.
 * SecureStore cannot list what it holds, so a key missing here would survive
 * the wipe on reinstall.
 */
export const SECURE_STORE_KEYS: readonly string[] = [
  SESSION_KEY,
  ...SESSION_CHUNK_KEYS,
  ...DEVICE_KEYS,
];

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
