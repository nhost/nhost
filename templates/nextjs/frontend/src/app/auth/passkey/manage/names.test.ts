import { describe, expect, it } from 'vitest';
import { deviceName, unusedName } from '@/app/auth/passkey/manage/names';

describe('deviceName', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Chrome - macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari - iOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
      'Chrome - iOS',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'Edge - Windows',
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
      'Firefox - Linux',
    ],
    ['curl/8.7.1', undefined],
  ])('%s', (userAgent, expected) => {
    expect(deviceName(userAgent)).toBe(expected);
  });
});

describe('unusedName', () => {
  it('numbers a taken name from 2, past the numbers already used', () => {
    expect(unusedName('Chrome - macOS', ['Chrome - macOS'])).toBe(
      'Chrome - macOS 2',
    );
    expect(
      unusedName('Chrome - macOS', ['Chrome - macOS', 'Chrome - macOS 2']),
    ).toBe('Chrome - macOS 3');
  });
});
