import type { WebBrowserAuthSessionResult } from 'expo-web-browser';
import { SIGNED_OUT } from '@/lib/nhost/errors';
import { readFlows, redirectSystemPath } from '@/lib/nhost/links';
import { RETURN_URL } from '@/screens/auth/oauth/actions';
import {
  linkProvider,
  unlinkProvider,
} from '@/screens/auth/oauth/linked/actions';

const mockClient = {
  session: null as object | null,
  verifiedUser: null as { id: string; email?: string } | null,
  graphql: { request: jest.fn() },
  refreshSession: jest.fn(),
  tokenExchange: jest.fn(),
};

// The SDK's own URL builder, so the query auth would receive is the real one.
jest.mock('@/lib/nhost/client', () => {
  const { createAPIClient } = jest.requireActual<
    typeof import('@nhost/nhost-js/auth')
  >('@nhost/nhost-js/auth');
  return {
    LINK_TYPE_PARAM: 'type',
    nhost: {
      auth: createAPIClient('https://local.auth.local.nhost.run/v1'),
      getUserSession: () => mockClient.session,
      refreshSession: (margin: number) => mockClient.refreshSession(margin),
      graphql: {
        request: (...args: unknown[]) => mockClient.graphql.request(...args),
      },
    },
    bareAuth: () => ({
      tokenExchange: (...args: unknown[]) => mockClient.tokenExchange(...args),
    }),
    getVerifiedUser: async () => ({ user: mockClient.verifiedUser }),
  };
});

jest.mock('@/lib/nhost/startSession', () => ({
  START_TIMEOUT_MS: 10_000,
  startSession: () => Promise.resolve(),
}));

const mockGoTo = jest.fn<void, [string]>();

jest.mock('@/lib/goTo', () => ({
  goTo: (href: string) => mockGoTo(href),
}));

const mockOpen = jest.fn<
  Promise<WebBrowserAuthSessionResult>,
  [string, string]
>();

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (url: string, returnUrl: string) =>
    mockOpen(url, returnUrl),
}));

const sentTo = (call = 0): URL => new URL(mockOpen.mock.calls[call]?.[0] ?? '');

/** Where auth sends the browser back to: `redirectTo`, plus `params`. */
const returned = (params = '', call = 0): string => {
  const redirectTo = sentTo(call).searchParams.get('redirectTo') ?? '';
  return params ? `${redirectTo}&${params}` : redirectTo;
};

const comesBack = (params = ''): void => {
  mockOpen.mockImplementation(async () => ({
    type: 'success',
    url: returned(params, mockOpen.mock.calls.length - 1),
  }));
};

const links = (...ids: string[]) => ({
  body: {
    data: {
      authUserProviders: ids.map((id) => ({
        id,
        providerId: id,
        createdAt: '2026-10-01T00:00:00Z',
      })),
    },
  },
});

const deleted = (id: string | null) => ({
  body: { data: { deleteAuthUserProvider: id ? { id } : null } },
});

beforeEach(() => {
  mockClient.session = { user: { id: 'user-1' } };
  mockClient.verifiedUser = { id: 'user-1', email: 'user@example.com' };
  mockClient.graphql.request.mockReset();
  mockClient.refreshSession.mockReset();
  mockClient.refreshSession.mockResolvedValue({ accessToken: 'access-token' });
  mockClient.tokenExchange.mockReset();
  mockGoTo.mockReset();
  mockOpen.mockReset();
  comesBack();
});

describe('linkProvider', () => {
  it('sends the session to the provider as the account to link to', async () => {
    await linkProvider('github');

    expect(mockClient.refreshSession).toHaveBeenCalledWith(60);
    expect(sentTo().pathname).toBe('/v1/signin/provider/github');
    expect(sentTo().searchParams.get('connect')).toBe('access-token');
    expect(sentTo().searchParams.get('redirectTo')).toMatch(
      /^nhost-starter:\/\/account\?flow=[\w-]+$/,
    );
    expect(returned().startsWith(RETURN_URL)).toBe(true);
    expect(sentTo().searchParams.get('upstreamParams[prompt]')).toBe(
      'select_account',
    );
    expect(mockOpen.mock.calls[0]?.[1]).toBe(RETURN_URL);
  });

  // iOS encodes a URL with a raw bracket again, `redirectTo` included.
  it('opens a URL with no raw brackets', async () => {
    await linkProvider('github');

    expect(mockOpen.mock.calls[0]?.[0]).not.toMatch(/[[\]]/);
  });

  // Auth returns to `redirectTo` as it was, with no code to protect.
  it('starts no flow and sends no challenge', async () => {
    await linkProvider('github');

    expect(sentTo().searchParams.has('codeChallenge')).toBe(false);
    expect(readFlows()).toEqual([]);
  });

  // Android also delivers the return as an intent, a plain link to the
  // account screen the user is on.
  it('trades nothing once linked', async () => {
    expect(await linkProvider('github')).toEqual({ success: true });
    await expect(
      redirectSystemPath({ path: returned(), initial: false }),
    ).resolves.toBe('/account');

    expect(mockClient.tokenExchange).not.toHaveBeenCalled();
    expect(mockGoTo).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'dismiss'])(
    'does nothing when the browser closes with %s',
    async (type) => {
      mockOpen.mockResolvedValue({ type } as WebBrowserAuthSessionResult);

      expect(await linkProvider('github')).toEqual({});
      expect(mockGoTo).not.toHaveBeenCalled();
    },
  );

  const TAKEN = 'error=provider-account-already-linked&errorDescription=Taken';
  const SHOWN =
    '/account?error=provider-account-already-linked&errorDescription=Taken';

  it("shows auth's error on the account screen, once", async () => {
    comesBack(TAKEN);

    expect(await linkProvider('github')).toEqual({});
    await redirectSystemPath({ path: returned(TAKEN), initial: false });

    expect(mockGoTo.mock.calls).toEqual([[SHOWN]]);
    expect(mockClient.tokenExchange).not.toHaveBeenCalled();
  });

  // Each trip comes back with its own id, so the second is not taken for a
  // delivery of the first.
  it('shows the same error again for another trip', async () => {
    comesBack(TAKEN);

    await linkProvider('github');
    await linkProvider('github');

    expect(mockGoTo.mock.calls).toEqual([[SHOWN], [SHOWN]]);
  });

  it('opens nothing for a session that is gone', async () => {
    mockClient.refreshSession.mockResolvedValue(null);

    expect(await linkProvider('github')).toEqual({ error: SIGNED_OUT });
    expect(mockOpen).not.toHaveBeenCalled();
  });
});

describe('unlinkProvider', () => {
  it('deletes the link', async () => {
    mockClient.graphql.request
      .mockResolvedValueOnce(links('github'))
      .mockResolvedValueOnce(deleted('github'));

    expect(await unlinkProvider('github')).toEqual({ success: true });
    expect(mockClient.graphql.request.mock.calls[1][0].variables).toEqual({
      id: 'github',
    });
  });

  // With no address, the email methods cannot sign in, so the provider is the
  // only way back into the account.
  it('keeps the only way in to an account with no email', async () => {
    mockClient.verifiedUser = { id: 'user-1' };
    mockClient.graphql.request.mockResolvedValueOnce(links('github'));

    expect((await unlinkProvider('github')).error).toContain(
      'only way to sign in',
    );
    expect(mockClient.graphql.request).toHaveBeenCalledTimes(1);
  });
});
