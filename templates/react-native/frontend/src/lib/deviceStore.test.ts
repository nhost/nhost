import * as SecureStore from 'expo-secure-store';
import {
  clearDeviceItem,
  DEVICE_KEYS,
  getDeviceItem,
  SECURE_STORE_OPTIONS,
  setDeviceItem,
} from '@/lib/deviceStore';

jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
    getItem: jest.fn((key: string) => items.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      items.set(key, value);
    }),
    deleteItemAsync: jest.fn(),
  };
});

const mocked = jest.mocked(SecureStore);

describe('deviceStore', () => {
  it('reads back what it wrote', () => {
    setDeviceItem('nhostLastSignIn', 'value');

    expect(getDeviceItem('nhostLastSignIn')).toBe('value');
  });

  // An async delete could land after a later write and lose it, so clearing
  // writes '' and reads take '' for unset.
  it('clears by writing an empty value, never by deleting', () => {
    setDeviceItem('nhostSignInAttempt', 'value');
    clearDeviceItem('nhostSignInAttempt');

    expect(getDeviceItem('nhostSignInAttempt')).toBeNull();
    expect(mocked.setItem).toHaveBeenLastCalledWith(
      'nhostSignInAttempt',
      '',
      SECURE_STORE_OPTIONS,
    );
    expect(mocked.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('reads a key never written as unset', () => {
    expect(getDeviceItem('nhostPasswordReset')).toBeNull();
  });

  it('passes the shared options on every call', () => {
    jest.clearAllMocks();
    setDeviceItem('nhostLastSignIn', 'value');
    getDeviceItem('nhostLastSignIn');
    clearDeviceItem('nhostLastSignIn');

    const calls = [...mocked.getItem.mock.calls, ...mocked.setItem.mock.calls];

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.at(-1)).toBe(SECURE_STORE_OPTIONS);
    }
    expect(SECURE_STORE_OPTIONS).toEqual({
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  });

  it('names each key once, in a form SecureStore accepts', () => {
    expect(new Set(DEVICE_KEYS).size).toBe(DEVICE_KEYS.length);
    for (const key of DEVICE_KEYS) {
      expect(key).toMatch(/^[\w.-]+$/);
    }
  });
});
