import { getDeviceItem, setDeviceItem } from '@/lib/deviceStore';

// The passkeys this device has seen: the ones added or used here.
const KEY = 'nhostPasskeys';
const MAX = 10;
// One SecureStore value. Credential ids are base64url, one byte a character.
const MAX_BYTES = 2048;

function read(): string[] {
  try {
    const ids: unknown = JSON.parse(getDeviceItem(KEY) ?? '[]');
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  let kept = ids.slice(-MAX);
  while (JSON.stringify(kept).length > MAX_BYTES) {
    kept = kept.slice(1);
  }
  try {
    setDeviceItem(KEY, JSON.stringify(kept));
  } catch (err) {
    // This is only ever a hint.
    console.warn('Could not remember the passkey on this device:', err);
  }
}

export function rememberPasskey(credentialId: string): void {
  write([...read().filter((id) => id !== credentialId), credentialId]);
}

export function forgetPasskey(credentialId: string): void {
  write(read().filter((id) => id !== credentialId));
}

export function passkeysOnThisDevice(): Set<string> {
  return new Set(read());
}
