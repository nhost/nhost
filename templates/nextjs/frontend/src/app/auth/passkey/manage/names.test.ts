import { describe, expect, it } from 'vitest';
import {
  deviceName,
  passkeyName,
  unusedName,
} from '@/app/auth/passkey/manage/names';

describe('deviceName', () => {
  it('words the browser and system the way the Sessions list does', () => {
    expect(
      deviceName(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari - iOS');
  });

  it('gives no name when the user agent says nothing it knows', () => {
    expect(deviceName(undefined)).toBeUndefined();
    expect(deviceName('curl/8.0')).toBeUndefined();
  });
});

describe('unusedName', () => {
  it('keeps a name no passkey has', () => {
    expect(unusedName('Chrome - macOS', ['laptop', null])).toBe(
      'Chrome - macOS',
    );
  });

  it('numbers a taken name from 2, past the numbers already used', () => {
    expect(unusedName('Chrome - macOS', ['Chrome - macOS'])).toBe(
      'Chrome - macOS 2',
    );
    expect(
      unusedName('Chrome - macOS', ['Chrome - macOS', 'Chrome - macOS 2']),
    ).toBe('Chrome - macOS 3');
  });
});

describe('passkeyName', () => {
  it('uses the nickname', () => {
    expect(passkeyName({ nickname: 'Chrome - macOS' }, 0)).toBe(
      'Chrome - macOS',
    );
  });

  // One added before blank names were filled in.
  it('numbers an unnamed passkey by its place in the list', () => {
    expect(passkeyName({ nickname: null }, 1)).toBe('Passkey 2');
  });
});
