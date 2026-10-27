import { describe, expect, it } from 'vitest';
import {
  describeAddress,
  describeLocation,
  describeUserAgent,
  needsUpdate,
  requestDetails,
  SEEN_AT_INTERVAL_MS,
} from '@/lib/nhost/session-metadata';

describe('requestDetails', () => {
  it("reads Vercel's location headers", () => {
    expect(
      requestDetails(
        new Headers({
          'x-vercel-ip-country': 'DE',
          'x-vercel-ip-country-region': 'BY',
          'x-vercel-ip-city': 'M%C3%BCnchen',
        }),
      ),
    ).toMatchObject({ country: 'DE', region: 'BY', city: 'München' });
  });
});

describe('needsUpdate', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const current = { ip: '203.0.113.4', userAgent: 'UA', country: 'DE' };
  const stored = { ...current, seenAt: new Date(now - 1000).toISOString() };

  it('leaves recent, matching details alone', () => {
    expect(needsUpdate(stored, current, now)).toBe(false);
  });

  it('writes once seenAt is older than the interval', () => {
    const old = {
      ...stored,
      seenAt: new Date(now - SEEN_AT_INTERVAL_MS).toISOString(),
    };
    expect(needsUpdate(old, current, now)).toBe(true);
  });
});

describe('describeUserAgent', () => {
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
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      'Chrome - Android',
    ],
    ['curl/8.7.1', 'Unknown device'],
  ])('%s', (userAgent, expected) => {
    expect(describeUserAgent(userAgent)).toBe(expected);
  });
});

describe('describeLocation', () => {
  it('falls back to the country without a city', () => {
    expect(describeLocation({ country: 'SE' })).toBe('Sweden');
  });
});

describe('describeAddress', () => {
  it.each([
    ['::1', undefined],
    ['127.0.0.1', undefined],
    ['::ffff:127.0.0.1', undefined],
    ['::ffff:203.0.113.4', '203.0.113.4'],
    ['2001:db8::1', '2001:db8::1'],
    [undefined, undefined],
  ])('%s reads %s', (ip, expected) => {
    expect(describeAddress(ip)).toBe(expected);
  });
});
