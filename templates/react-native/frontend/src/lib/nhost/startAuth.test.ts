import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkErrorMessage } from '@/lib/nhost/linkToken';
import { startAuth } from '@/lib/nhost/startAuth';

const LINK = 'nhoststarter:///protected?refreshToken=abc123';
const FAILED =
  'nhoststarter:///protected?error=invalid-ticket&errorDescription=Expired';
const EXPIRED = linkErrorMessage('invalid-ticket');

afterEach(() => {
  vi.restoreAllMocks();
});

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
    onLinkError: (message) => events.push(`link error ${message}`),
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

  // So the notice is up by the time the screen the link opens stops waiting.
  it('reports a failed link before it stops loading, and redeems nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events, hydrated } = setup(FAILED);

    hydrated();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    expect(events).toContain(`link error ${EXPIRED}`);
    expect(events.indexOf(`link error ${EXPIRED}`)).toBeGreaterThan(
      events.indexOf('hydrated'),
    );
    expect(events.some((event) => event.startsWith('redeem'))).toBe(false);
  });

  it('is loading while a failed link that arrives later is reported', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events, hydrated, arrive } = setup();

    hydrated();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    arrive(FAILED);
    expect(events.at(-1)).toBe('loading true');

    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));
    expect(events.at(-2)).toBe(`link error ${EXPIRED}`);
  });

  // It spent nothing, and a user who dismissed the notice and taps the same
  // expired email again has to be told again.
  it('reports a failed link each time it is opened', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events, hydrated, arrive } = setup(FAILED);

    hydrated();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    arrive(FAILED);
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    expect(events.filter((event) => event === `link error ${EXPIRED}`)).toEqual(
      [`link error ${EXPIRED}`, `link error ${EXPIRED}`],
    );
  });

  it('still skips a token already taken when a failed link came between', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events, hydrated, redeemed, arrive } = setup(LINK);

    hydrated();
    await vi.waitFor(() => expect(events).toContain(`redeem ${LINK}`));
    redeemed();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    arrive(FAILED);
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));
    const before = events.length;
    arrive(LINK);

    expect(events.length).toBe(before);
  });

  it('clears the error when a link with a token follows', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events, hydrated, redeemed, arrive } = setup(FAILED);

    hydrated();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    arrive(LINK);
    await vi.waitFor(() => expect(events).toContain(`redeem ${LINK}`));
    expect(events.at(-2)).toBe('link error null');
    redeemed();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));
  });

  // The service never sends both, so a link that has both was put together by
  // somebody else.
  it('does not redeem a token on a link that also carries an error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { events, hydrated } = setup(`${FAILED}&refreshToken=abc123`);

    hydrated();
    await vi.waitFor(() => expect(events.at(-1)).toBe('loading false'));

    expect(events).toContain(`link error ${EXPIRED}`);
    expect(events.some((event) => event.startsWith('redeem'))).toBe(false);
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
