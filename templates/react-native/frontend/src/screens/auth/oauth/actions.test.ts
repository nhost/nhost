import type { Session } from '@nhost/nhost-js/auth';
import type { StoredSession } from '@nhost/nhost-js/session';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';
import { readFlows, redirectSystemPath } from '@/lib/nhost/links';
import { codeChallenge } from '@/lib/nhost/pkce';
import {
  BROWSER_ERROR,
  RETURN_URL,
  signInWithProvider,
} from '@/screens/auth/oauth/actions';
import {
  lastUsedSignIn,
  promoteSignInAttempt,
} from '@/screens/signin/lastUsed';

const mockFake = {
  session: null as StoredSession | null,
  tokenExchange: jest.fn<
    Promise<{ body: { session?: Session } }>,
    [{ code: string; codeVerifier: string }]
  >(),
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
      getUserSession: () => mockFake.session,
      sessionStorage: {
        set: (session: StoredSession) => {
          mockFake.session = session;
        },
      },
    },
    bareAuth: () => ({
      tokenExchange: (body: { code: string; codeVerifier: string }) =>
        mockFake.tokenExchange(body),
    }),
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

// The result's enum comes from the module mocked above.
const closed = (type: 'cancel' | 'dismiss') =>
  ({ type }) as WebBrowserAuthSessionResult;

const opened = (): { url: URL; returnUrl: string } => {
  const [url, returnUrl] = mockOpen.mock.calls[0] ?? [];
  return { url: new URL(url ?? ''), returnUrl: returnUrl ?? '' };
};

const redirectTo = (): string =>
  opened().url.searchParams.get('redirectTo') ?? '';

/** What auth sends the browser back to once the provider signed the user in. */
const returned = (params: string): string =>
  `${redirectTo().replace('nhost-starter://account', 'nhost-starter://account/')}&${params}`;

/** The browser comes back with whatever auth redirects it to. */
function browserReturns(params: string): void {
  mockOpen.mockImplementation(async () => ({
    type: 'success',
    url: returned(params),
  }));
}

beforeEach(() => {
  mockFake.session = null;
  mockFake.tokenExchange.mockReset();
  mockFake.tokenExchange.mockResolvedValue({
    body: { session: { refreshToken: 'from-provider' } as Session },
  });
  mockGoTo.mockReset();
  mockOpen.mockReset();
  mockOpen.mockResolvedValue(closed('cancel'));
});

describe('signInWithProvider', () => {
  it('opens the provider in the in-app browser with a PKCE challenge', async () => {
    await signInWithProvider('github', '/account');

    const { url, returnUrl } = opened();
    const [flow] = readFlows();
    expect(url.pathname).toBe('/v1/signin/provider/github');
    expect(flow).toMatchObject({ kind: 'signIn' });
    expect(url.searchParams.get('codeChallenge')).toBe(
      await codeChallenge(flow?.verifier ?? ''),
    );
    expect(redirectTo()).toBe(`nhost-starter://account?flow=${flow?.id}`);
    expect(returnUrl).toBe('nhost-starter://');
  });

  // The browser only closes on a redirect that starts with the return URL.
  it('sends auth back to an address the browser closes on', async () => {
    await signInWithProvider('github', '/account?tab=1');

    expect(redirectTo().startsWith(RETURN_URL)).toBe(true);
    expect(redirectTo().startsWith(opened().returnUrl)).toBe(true);
  });

  it('keeps the trip in this app whatever next it is given', async () => {
    await signInWithProvider('github', '//evil.example');

    expect(redirectTo()).toMatch(/^nhost-starter:\/\/account\?flow=[\w-]+$/);
  });

  // Otherwise a provider the user authorized before signs them in without
  // showing anything.
  it('asks the provider to show its account picker', async () => {
    await signInWithProvider('google', '/account');

    expect(opened().url.searchParams.get('upstreamParams[prompt]')).toBe(
      'select_account',
    );
  });

  // iOS encodes a URL with a raw bracket again, `redirectTo` included.
  it('opens a URL with no raw brackets', async () => {
    await signInWithProvider('google', '/account');

    expect(mockOpen.mock.calls[0]?.[0]).not.toMatch(/[[\]]/);
  });

  it('notes the provider as the way the visitor is signing in', async () => {
    await signInWithProvider('google', '/account');
    promoteSignInAttempt();

    expect(lastUsedSignIn()).toBe('/auth/oauth/google');
  });

  it.each(['cancel', 'dismiss'] as const)(
    'does nothing when the browser closes with %s',
    async (type) => {
      mockOpen.mockResolvedValue(closed(type));

      expect(await signInWithProvider('github', '/account')).toEqual({});
      expect(mockFake.tokenExchange).not.toHaveBeenCalled();
      expect(mockGoTo).not.toHaveBeenCalled();
    },
  );

  it('says so when the browser cannot open', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockOpen.mockRejectedValue(new Error('WebBrowser is already open'));

    expect(await signInWithProvider('github', '/account')).toEqual({
      error: BROWSER_ERROR,
    });
  });
});

// iOS hands the redirect over only as the browser's result. Android also
// delivers it to the app as an intent, through `+native-intent`, before or
// after the result. Whichever comes first trades the code and navigates. A
// code is handled once per process, so every test uses its own.
describe('the link the browser comes back with', () => {
  it('signs in and opens the destination, on iOS', async () => {
    browserReturns('code=ios');

    expect(await signInWithProvider('github', '/account')).toEqual({
      success: true,
    });

    const [flow] = readFlows();
    expect(mockFake.tokenExchange).toHaveBeenCalledWith({
      code: 'ios',
      codeVerifier: expect.any(String),
    });
    expect(flow?.consumedAt).toEqual(expect.any(Number));
    expect(mockFake.session).toEqual({ refreshToken: 'from-provider' });
    expect(mockGoTo.mock.calls).toEqual([['/account']]);
  });

  it('navigates once when the OS delivers it first, on Android', async () => {
    let os: Promise<string | null> | undefined;
    mockOpen.mockImplementation(async () => {
      const url = returned('code=os-first');
      os = redirectSystemPath({ path: url, initial: false });
      return { type: 'success', url };
    });

    await signInWithProvider('github', '/account');

    await expect(os).resolves.toBeNull();
    expect(mockFake.tokenExchange).toHaveBeenCalledTimes(1);
    expect(mockGoTo.mock.calls).toEqual([['/account']]);
  });

  it('navigates once when the result comes first, on Android', async () => {
    browserReturns('code=result-first');

    await signInWithProvider('github', '/account');
    const os = await redirectSystemPath({
      path: returned('code=result-first'),
      initial: false,
    });

    expect(os).toBeNull();
    expect(mockFake.tokenExchange).toHaveBeenCalledTimes(1);
    expect(mockGoTo.mock.calls).toEqual([['/account']]);
  });

  // As when the provider is not turned on in nhost.toml.
  it("shows auth's error once, whichever delivery comes first", async () => {
    const error = 'error=disabled-endpoint&errorDescription=Provider+disabled';
    let os: Promise<string | null> | undefined;
    mockOpen.mockImplementation(async () => {
      const url = returned(error);
      os = redirectSystemPath({ path: url, initial: false });
      return { type: 'success', url };
    });

    await signInWithProvider('github', '/account');
    await os;

    expect(mockFake.tokenExchange).not.toHaveBeenCalled();
    expect(mockGoTo.mock.calls).toEqual([
      ['/account?error=disabled-endpoint&errorDescription=Provider%20disabled'],
    ]);
  });
});
