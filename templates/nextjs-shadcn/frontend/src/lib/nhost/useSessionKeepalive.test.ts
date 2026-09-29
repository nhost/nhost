import { describe, expect, it } from 'vitest';
import {
  PROXY_REFRESH_MARGIN_MS,
  planKeepalive,
  REFRESH_WITHIN_MS,
} from '@/lib/nhost/useSessionKeepalive';

const NOW = 1_700_000_000_000;

// The whole point of the keepalive is that the request it makes arrives while
// the proxy is still willing to rotate. `handleNhostProxy` calls
// `nhost.refreshSession(60)`, which returns the session untouched when the
// token has more than 60s left, so a wake-up outside that window is a request
// that changes nothing and a token that expires anyway.
//
// This is the assertion to read first if someone changes either number: they
// are one decision written in two files.
describe('the wake-up lands inside the proxy refresh window', () => {
  it('asks for a refresh early enough that the proxy performs one', () => {
    expect(REFRESH_WITHIN_MS).toBeLessThan(PROXY_REFRESH_MARGIN_MS);
  });

  // Not just inside it, but with time for the round trip. A wake-up at 59s
  // would satisfy the rule above and still routinely lose to a slow network.
  it('leaves room for the request to complete', () => {
    expect(REFRESH_WITHIN_MS).toBeGreaterThanOrEqual(30_000);
  });
});

describe('planKeepalive', () => {
  it('keeps looking when nobody is signed in', () => {
    // Signing in does not remount the hook, so stopping here would mean the
    // keepalive never ran for anyone who signed in on an already-open tab.
    expect(planKeepalive(undefined, NOW)).toEqual({
      action: 'sleep',
      ms: 30_000,
    });
  });

  it('sleeps until the refresh window opens', () => {
    const step = planKeepalive(NOW + 15 * 60_000, NOW);

    expect(step.action).toBe('sleep');
  });

  it('never sleeps past the point of being a clock', () => {
    // A quarter of an hour away, but the sleep is bounded: a suspended laptop
    // or a throttled tab makes a long timer land somewhere other than where it
    // was aimed.
    const step = planKeepalive(NOW + 15 * 60_000, NOW);

    expect(step).toEqual({ action: 'sleep', ms: 60_000 });
  });

  it('refreshes once inside the window', () => {
    expect(planKeepalive(NOW + REFRESH_WITHIN_MS - 1, NOW)).toEqual({
      action: 'refresh',
    });
  });

  it('refreshes exactly on the boundary', () => {
    expect(planKeepalive(NOW + REFRESH_WITHIN_MS, NOW)).toEqual({
      action: 'refresh',
    });
  });

  // The refresh token outlives the access token by a month, so an expired
  // access token is still worth one ask - this is the tab that was left open
  // overnight, and refusing to try is what would strand it on a visible error.
  it('still asks for a token that has already expired', () => {
    expect(planKeepalive(NOW - 60 * 60_000, NOW)).toEqual({
      action: 'refresh',
    });
  });

  // Just outside the window: this must sleep rather than refresh, or the
  // keepalive would spin against a proxy that keeps declining to rotate.
  it('does not refresh while the token is outside the window', () => {
    const step = planKeepalive(NOW + REFRESH_WITHIN_MS + 1_000, NOW);

    expect(step).toEqual({ action: 'sleep', ms: 1_000 });
  });
});
