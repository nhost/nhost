import { describe, expect, it, vi } from 'vitest';
import { startAuth } from '@/lib/nhost/startAuth';

const LINK = 'nhoststarter:///protected?refreshToken=abc123';

function deferred(): { promise: Promise<void>; resolve: VoidFunction } {
  let resolve: VoidFunction = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Stands in for the disk, the linking module and the auth service, recording
// the order things happen in and leaving each step pending until the test
// lets it finish.
function setup(initial: string | null = null) {
  const events: string[] = [];
  const disk = deferred();
  const redemptions: VoidFunction[] = [];
  let onURL: (url: string) => void = () => {};

  const stop = startAuth({
    hydrate: async () => {
      events.push('hydrate');
      await disk.promise;
      events.push('hydrated');
    },
    initialURL: async () => initial,
    listen: (callback) => {
      onURL = callback;
      return () => events.push('unlisten');
    },
    redeem: async (url) => {
      events.push(`redeem ${url}`);
      const done = deferred();
      redemptions.push(done.resolve);
      await done.promise;
      events.push(`redeemed ${url}`);
    },
    onLoading: (isLoading) => events.push(`loading ${isLoading}`),
  });

  return {
    events,
    stop,
    hydrated: disk.resolve,
    redeemed: () => redemptions.shift()?.(),
    arrive: (url: string) => onURL(url),
  };
}

describe('startAuth', () => {
  it('stays loading until the stored session has been read', async () => {
    const { events, hydrated } = setup();

    await vi.waitFor(() => expect(events).toContain('hydrate'));
    expect(events).not.toContain('loading false');

    hydrated();

    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));
  });

  // A screen that decided once the disk had been read would see nobody signed
  // in while the emailed link was still being exchanged.
  it('stays loading until the link the app was opened with is redeemed', async () => {
    const { events, hydrated, redeemed } = setup(LINK);

    hydrated();
    await vi.waitFor(() => expect(events).toContain(`redeem ${LINK}`));
    expect(events).not.toContain('loading false');

    redeemed();

    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));
    expect(events.filter((event) => event === 'loading false')).toHaveLength(1);
  });

  // Reading the disk replaces whatever is in memory, so a redemption that
  // finished first would be thrown away.
  it('does not redeem a link that arrives before the disk has been read', async () => {
    const { events, hydrated, redeemed, arrive } = setup();

    arrive(LINK);
    await Promise.resolve();
    expect(events).not.toContain(`redeem ${LINK}`);

    hydrated();
    await vi.waitFor(() => expect(events).toContain(`redeem ${LINK}`));
    expect(events.indexOf('hydrated')).toBeLessThan(
      events.indexOf(`redeem ${LINK}`),
    );
    expect(events).not.toContain('loading false');

    redeemed();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));
  });

  it('is loading again while a link that arrives later is redeemed', async () => {
    const { events, hydrated, redeemed, arrive } = setup();

    hydrated();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    arrive(LINK);
    expect(events.at(-1)).toBe('loading true');

    await vi.waitFor(() => expect(events).toContain(`redeem ${LINK}`));
    redeemed();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));
  });

  it('leaves loading alone for a link with no token, or one already taken', async () => {
    const { events, hydrated, redeemed, arrive } = setup(LINK);

    hydrated();
    await vi.waitFor(() => expect(events).toContain(`redeem ${LINK}`));
    redeemed();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    const before = events.length;
    arrive(LINK);
    arrive('nhoststarter:///protected');

    expect(events.length).toBe(before);
  });

  it('starts nothing new once stopped', async () => {
    const { events, hydrated, stop } = setup(LINK);

    await vi.waitFor(() => expect(events).toContain('hydrate'));
    stop();
    hydrated();
    await vi.waitFor(() => expect(events).toContain('hydrated'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toContain('unlisten');
    expect(events).not.toContain(`redeem ${LINK}`);
    expect(events).not.toContain('loading false');
  });
});
