import {
  deviceName,
  passkeyName,
  unusedName,
} from '@/screens/auth/passkey/manage/names';

describe('deviceName', () => {
  it.each([
    [{ modelName: 'Pixel 8', osName: 'Android' }, 'Pixel 8 - Android'],
    [{ modelName: 'iPhone 16', osName: 'iOS' }, 'iPhone 16 - iOS'],
    [{ modelName: null, osName: 'iPadOS' }, 'iPadOS'],
    [{ modelName: null, osName: null }, undefined],
  ])('%j', (device, expected) => {
    expect(deviceName(device)).toBe(expected);
  });
});

describe('unusedName', () => {
  it('numbers a taken name from 2, past the numbers already used', () => {
    expect(unusedName('Pixel 8 - Android', ['Pixel 8 - Android'])).toBe(
      'Pixel 8 - Android 2',
    );
    expect(
      unusedName('Pixel 8 - Android', [
        'Pixel 8 - Android',
        'Pixel 8 - Android 2',
      ]),
    ).toBe('Pixel 8 - Android 3');
  });
});

describe('passkeyName', () => {
  it('names an unnamed passkey by its place in the list', () => {
    expect(passkeyName({ nickname: 'laptop' }, 0)).toBe('laptop');
    expect(passkeyName({ nickname: null }, 1)).toBe('Passkey 2');
  });
});
