import type { NhostClient } from '@nhost/nhost-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchSession } from '$lib/nhost/watchSession';

const fakeClient = () => {
  const subscribers = new Set<(session: object | null) => void>();
  let session: object | null = null;

  return {
    sessionStorage: {
      onChange: (callback: (session: object | null) => void) => {
        subscribers.add(callback);
        return () => {
          subscribers.delete(callback);
        };
      },
    },
    getUserSession: () => session,
    // A write through this client, which the SDK reports to its subscribers.
    write: (next: object | null) => {
      session = next;
      for (const callback of subscribers) {
        callback(next);
      }
    },
    // A write from another tab, which reaches this one only as a `storage`
    // event.
    writeElsewhere: (next: object | null, key: string | null) => {
      session = next;
      window.dispatchEvent(Object.assign(new Event('storage'), { key }));
    },
  };
};

const asClient = (client: ReturnType<typeof fakeClient>) =>
  client as unknown as NhostClient;

describe('watchSession', () => {
  beforeEach(() => {
    vi.stubGlobal('window', new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows this tab's own writes", () => {
    const client = fakeClient();
    const listener = vi.fn();
    watchSession(asClient(client), listener);

    client.write({ refreshToken: 'mine' });

    expect(listener).toHaveBeenCalledWith({ refreshToken: 'mine' });
  });

  it("follows another tab's writes to the session key", () => {
    const client = fakeClient();
    const listener = vi.fn();
    watchSession(asClient(client), listener);

    client.writeElsewhere({ refreshToken: 'theirs' }, 'nhostSession');
    client.writeElsewhere(null, 'nhostSession');

    expect(listener.mock.calls).toEqual([[{ refreshToken: 'theirs' }], [null]]);
  });

  it('follows another tab clearing all of localStorage', () => {
    const client = fakeClient();
    const listener = vi.fn();
    watchSession(asClient(client), listener);

    client.writeElsewhere(null, null);

    expect(listener).toHaveBeenCalledWith(null);
  });

  it('ignores other keys', () => {
    const client = fakeClient();
    const listener = vi.fn();
    watchSession(asClient(client), listener);

    client.writeElsewhere(null, 'theme');

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops following both once stopped', () => {
    const client = fakeClient();
    const listener = vi.fn();
    const stop = watchSession(asClient(client), listener);

    stop();
    client.write({ refreshToken: 'mine' });
    client.writeElsewhere(null, 'nhostSession');

    expect(listener).not.toHaveBeenCalled();
  });
});
