// The passkeys this browser has seen: the ones added or used here. A browser
// does not tell a site which passkeys its device holds without showing a
// passkey prompt, so this is the only way to warn before the device refuses
// a second passkey for the same account. It misses a passkey synced from
// another device, one shared with another browser on this one, and any used
// before the site's data was cleared; `alreadyRegistered` covers those.
const KEY = 'nhostPasskeys';
const MAX = 20;

function read(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-MAX)));
  } catch (err) {
    // Storage can be full or turned off, and this is only ever a hint.
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

/**
 * Whether the device refused to add a passkey because it already holds one
 * of the account's: the auth service lists them as excluded, and the browser
 * answers with InvalidStateError, a name @simplewebauthn/browser keeps.
 */
export function alreadyRegistered(err: unknown): boolean {
  return (err as { name?: string }).name === 'InvalidStateError';
}
