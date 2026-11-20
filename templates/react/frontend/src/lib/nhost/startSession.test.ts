// @vitest-environment happy-dom
import type { StoredSession } from '@nhost/nhost-js/session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckedSession } from '@/lib/nhost/client';

const fake = vi.hoisted(() => ({
  session: null as StoredSession | null,
  refreshSession: vi.fn<(margin?: number) => Promise<unknown>>(),
  checkSession: vi.fn<(session: StoredSession) => Promise<CheckedSession>>(),
  revokeLinkToken: vi.fn<(token: string) => Promise<void>>(),
  redeem: vi.fn<(body: { refreshToken: string }) => Promise<unknown>>(),
  mainRefreshToken: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@/lib/nhost/client', () => ({
  LINK_TOKEN_PARAM: 'refreshToken',
  LINK_TYPE_PARAM: 'type',
  nhost: {
    auth: { refreshToken: fake.mainRefreshToken },
    refreshSession: fake.refreshSession,
    getUserSession: () => fake.session,
    sessionStorage: {
      set: (value: StoredSession) => {
        fake.set(value);
        fake.session = value;
      },
      remove: () => {
        fake.session = null;
      },
    },
  },
  bareAuth: () => ({ refreshToken: fake.redeem }),
  checkSession: fake.checkSession,
  revokeLinkToken: fake.revokeLinkToken,
}));

const MARKER = 'nhostPasswordReset';

const session = (refreshTokenId = 'id-1') =>
  ({ refreshToken: 'stored', refreshTokenId }) as StoredSession;

const redeemed = { refreshToken: 'from-link', refreshTokenId: 'id-2' };

// A fresh module per test: the promise it holds is once per page load.
async function start(url: string): Promise<void> {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { startSession } = await import('@/lib/nhost/startSession');
  await startSession();
}

// What the SDK's refresh does with a stored session the auth service rejects.
const rejectRefresh = async () => {
  fake.session = null;
  return null;
};

beforeEach(() => {
  localStorage.clear();
  fake.session = null;
  for (const mock of [
    fake.refreshSession,
    fake.checkSession,
    fake.revokeLinkToken,
    fake.redeem,
    fake.mainRefreshToken,
    fake.set,
  ]) {
    mock.mockReset();
  }
  fake.refreshSession.mockImplementation(async () => fake.session);
  fake.checkSession.mockResolvedValue('live');
  fake.redeem.mockResolvedValue({ body: redeemed });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startSession, the link token', () => {
  it('leaves the address bar with its type before anything is awaited', async () => {
    window.history.replaceState(
      null,
      '',
      '/somewhere?a=1&refreshToken=link&type=magicLink#top',
    );
    fake.refreshSession.mockReturnValue(new Promise(() => undefined));
    vi.resetModules();
    const { startSession } = await import('@/lib/nhost/startSession');

    void startSession();

    expect(window.location.pathname).toBe('/somewhere');
    expect(window.location.search).toBe('?a=1');
    expect(window.location.hash).toBe('#top');
  });

  it('signs a signed-out visitor in on the bare client', async () => {
    await start('/?refreshToken=link');

    expect(fake.redeem).toHaveBeenCalledWith({ refreshToken: 'link' });
    expect(fake.set).toHaveBeenCalledWith(redeemed);
    expect(fake.mainRefreshToken).not.toHaveBeenCalled();
    expect(fake.revokeLinkToken).not.toHaveBeenCalled();
  });

  // A link may not replace somebody who is already here.
  it('is revoked when somebody is signed in', async () => {
    fake.session = session();

    await start('/?refreshToken=link');

    expect(fake.revokeLinkToken).toHaveBeenCalledWith('link');
    expect(fake.redeem).not.toHaveBeenCalled();
    expect(fake.session).toEqual(session());
  });

  it('replaces a session the auth service refuses to refresh', async () => {
    fake.session = session();
    fake.refreshSession.mockImplementation(rejectRefresh);

    await start('/?refreshToken=link');

    expect(fake.revokeLinkToken).not.toHaveBeenCalled();
    expect(fake.session).toEqual(redeemed);
  });

  it('replaces a session revoked elsewhere', async () => {
    fake.session = session();
    fake.checkSession.mockResolvedValue('revoked');

    await start('/?refreshToken=link');

    expect(fake.checkSession).toHaveBeenCalledWith(session());
    expect(fake.session).toEqual(redeemed);
  });

  it('is stripped even when nothing can be reached', async () => {
    fake.refreshSession.mockRejectedValue(new TypeError('fetch failed'));
    fake.redeem.mockRejectedValue(new TypeError('fetch failed'));

    await start('/account?refreshToken=link&type=passwordReset');

    expect(window.location.search).toBe('');
    expect(fake.session).toBeNull();
  });

  it('resolves once however often it is called', async () => {
    window.history.replaceState(null, '', '/?refreshToken=link');
    vi.resetModules();
    const { startSession } = await import('@/lib/nhost/startSession');

    const first = startSession();
    expect(startSession()).toBe(first);
    await first;

    expect(fake.refreshSession).toHaveBeenCalledOnce();
    expect(fake.redeem).toHaveBeenCalledOnce();
  });
});

describe('startSession, the stored session', () => {
  // An outage is not a sign-out: the SDK keeps the session and so does this.
  it('keeps the session when the refresh fails for another reason', async () => {
    fake.session = session();
    fake.refreshSession.mockResolvedValue(null);
    fake.checkSession.mockResolvedValue('unknown');

    await start('/?refreshToken=link');

    expect(fake.session).toEqual(session());
    expect(fake.revokeLinkToken).toHaveBeenCalledWith('link');
  });

  it('keeps a session it cannot check', async () => {
    fake.session = session();
    fake.checkSession.mockResolvedValue('unknown');

    await start('/');

    expect(fake.session).toEqual(session());
  });

  it('keeps a session another tab started while the check ran', async () => {
    fake.session = session('id-1');
    fake.checkSession.mockImplementation(async () => {
      fake.session = session('id-3');
      return 'revoked';
    });

    await start('/');

    expect(fake.session).toEqual(session('id-3'));
  });
});

describe('startSession, a password reset', () => {
  it('confines the session a reset link starts to the page it landed on', async () => {
    await start('/auth/password/reset?refreshToken=link&type=passwordReset');

    expect(localStorage.getItem(MARKER)).toBe('/auth/password/reset');
    expect(fake.session).toEqual(redeemed);
  });

  it('leaves no marker when the reset link is spent', async () => {
    fake.redeem.mockRejectedValue(new Error('invalid-refresh-token'));

    await start('/auth/password/reset?refreshToken=link&type=passwordReset');

    expect(localStorage.getItem(MARKER)).toBeNull();
  });

  // The reset session expired; the marker it left must not hold the next
  // session to the reset page.
  it('does not confine a later sign-in of another kind', async () => {
    localStorage.setItem(MARKER, '/auth/password/reset');
    fake.session = session();
    fake.refreshSession.mockImplementation(rejectRefresh);

    await start('/?refreshToken=link&type=magicLink');

    expect(fake.session).toEqual(redeemed);
    expect(localStorage.getItem(MARKER)).toBeNull();
  });
});
