import type { Session } from '@nhost/nhost-js/auth';
import type { StoredSession } from '@nhost/nhost-js/session';
import { getDeviceItem, setDeviceItem } from '@/lib/deviceStore';
import { codeChallenge } from '@/lib/nhost/pkce';
import { mockDevice } from '@/test/device';

type Links = typeof import('@/lib/nhost/links');
type Exchange = { body: { session?: Session } };

const mockFake = {
  session: null as StoredSession | null,
  started: Promise.resolve(),
  initialURL: null as string | null,
  calls: [] as string[],
  tokenExchange: jest.fn<
    Promise<Exchange>,
    [{ code: string; codeVerifier: string }]
  >(),
  signOut: jest.fn<Promise<unknown>, [{ refreshToken: string }]>(),
};

jest.mock('@/lib/nhost/client', () => ({
  LINK_TYPE_PARAM: 'type',
  nhost: {
    getUserSession: () => mockFake.session,
    sessionStorage: {
      set: (session: StoredSession) => {
        const { getDeviceItem: marker } =
          jest.requireActual<typeof import('@/lib/deviceStore')>(
            '@/lib/deviceStore',
          );
        mockFake.calls.push(
          `set, marker ${marker('nhostPasswordReset') ?? 'none'}`,
        );
        mockFake.session = session;
      },
    },
  },
  bareAuth: () => ({
    tokenExchange: (body: { code: string; codeVerifier: string }) => {
      mockFake.calls.push('exchange');
      return mockFake.tokenExchange(body);
    },
    signOut: (body: { refreshToken: string }) => mockFake.signOut(body),
  }),
}));

jest.mock('@/lib/nhost/startSession', () => ({
  START_TIMEOUT_MS: 10_000,
  startSession: () => mockFake.started,
}));

jest.mock('expo-linking', () => ({
  getInitialURL: async () => mockFake.initialURL,
}));

const mockGoTo = jest.fn<void, [string]>();

jest.mock('@/lib/goTo', () => ({
  goTo: (href: string) => mockGoTo(href),
}));

const MARKER = 'nhostPasswordReset';
const FLOWS = 'nhostLinkFlows';

const exchanged = (refreshToken = 'from-link'): Exchange => ({
  body: { session: { refreshToken } as Session },
});

/** A fresh module, as on a new launch: what it remembers is per process. */
function load(): Links {
  let module: Links | undefined;
  jest.isolateModules(() => {
    module = require('@/lib/nhost/links');
  });
  return module as Links;
}

let links: Links;

/** The flow id a `redirectTo` from `startFlow` carries. */
const flowOf = (redirectTo: string): string =>
  /[?&]flow=([^&]+)/.exec(redirectTo)?.[1] ?? '';

async function issue(
  kind: Parameters<Links['startFlow']>[0] = 'signIn',
  destination = '/account',
) {
  const started = await links.startFlow(kind, destination);
  return { ...started, flow: flowOf(started.redirectTo) };
}

beforeEach(() => {
  mockFake.session = null;
  mockFake.started = Promise.resolve();
  mockFake.initialURL = null;
  mockFake.calls = [];
  mockFake.tokenExchange.mockReset();
  mockFake.tokenExchange.mockResolvedValue(exchanged());
  mockFake.signOut.mockReset();
  mockFake.signOut.mockResolvedValue({});
  mockGoTo.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  links = load();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('parseLink', () => {
  it.each([
    ['nhost-starter://account?a=1', '/account'],
    // Auth writes a `/` after the host when it appends its parameters.
    ['nhost-starter://account/?a=1', '/account'],
    ['nhost-starter:///account?a=1', '/account'],
    ['NHOST-STARTER://account?a=1', '/account'],
    ['nhost-starter://auth/password/reset/?a=1', '/auth/password/reset'],
    ['nhost-starter:?a=1', '/'],
    ['nhost-starter://?a=1', '/'],
    ['nhost-starter:///?a=1', '/'],
    ['/account?a=1', '/account'],
    ['/account/?a=1#top', '/account'],
    ['nhost-starter:////account?a=1', '/account'],
  ])('reads %s as %s', (input, path) => {
    expect(links.parseLink(input)).toEqual({ path, params: [['a', '1']] });
  });

  it('decodes the query, `+` as a space, keeping order and repeats', () => {
    expect(
      links.parseLink(
        'nhost-starter://account/?flow=x&error=invalid-ticket&errorDescription=Bad+ticket%2C+try%2B1&a=1&a=2&empty',
      )?.params,
    ).toEqual([
      ['flow', 'x'],
      ['error', 'invalid-ticket'],
      ['errorDescription', 'Bad ticket, try+1'],
      ['a', '1'],
      ['a', '2'],
      ['empty', ''],
    ]);
  });

  it('keeps a nested next, which survives the round trip', () => {
    const link = links.parseLink(
      'nhost-starter://signin?next=%2Faccount%3Ftab%3Dsessions%26x%3D1',
    );

    expect(link?.params).toEqual([['next', '/account?tab=sessions&x=1']]);
    expect(link && links.linkHref(link)).toBe(
      '/signin?next=%2Faccount%3Ftab%3Dsessions%26x%3D1',
    );
  });

  it.each([
    'https://example.com/account',
    'exp://127.0.0.1:8081/--/account',
    'account?a=1',
    '',
    'nhost-starter://account?a=%E0%A4%A',
  ])('refuses %j', (input) => {
    expect(links.parseLink(input)).toBeNull();
  });
});

describe('consumeLink', () => {
  it('returns a link without a code or auth error at once', async () => {
    mockFake.started = new Promise(() => undefined);

    await expect(
      links.consumeLink('nhost-starter://account?tab=1&flow=x&type=y'),
    ).resolves.toBe('/account?tab=1');
    await expect(links.consumeLink('nhost-starter://')).resolves.toBe('/');
    await expect(links.consumeLink('https://example.com')).resolves.toBe('/');
  });

  it('waits for startup before it looks at a code', async () => {
    let start: VoidFunction = () => undefined;
    mockFake.started = new Promise((resolve) => {
      start = resolve;
    });
    const { flow } = await issue();
    const route = links.consumeLink(
      `nhost-starter://account/?flow=${flow}&code=c`,
    );

    await Promise.resolve();
    expect(mockFake.tokenExchange).not.toHaveBeenCalled();

    start();
    await expect(route).resolves.toBe('/account');
  });

  it('trades the code on the bare client for a signed-out visitor', async () => {
    const { flow, codeChallenge: challenge } = await issue();

    await expect(
      links.consumeLink(
        `nhost-starter://account/?next=%2Fx&flow=${flow}&code=the-code&type=passwordlessEmail`,
      ),
    ).resolves.toBe('/account?next=%2Fx');

    const [[request]] = mockFake.tokenExchange.mock.calls;
    expect(request.code).toBe('the-code');
    expect(await codeChallenge(request.codeVerifier)).toBe(challenge);
    expect(mockFake.session).toEqual({ refreshToken: 'from-link' });
    expect(getDeviceItem(MARKER)).toBeNull();
  });

  it('confines a reset link before it stores the session', async () => {
    const { flow } = await issue('passwordReset', '/auth/password/reset');

    await expect(
      links.consumeLink(
        `nhost-starter://auth/password/reset/?flow=${flow}&code=c&type=passwordReset`,
      ),
    ).resolves.toBe('/auth/password/reset');

    expect(mockFake.calls).toEqual([
      'exchange',
      'set, marker /auth/password/reset',
    ]);
  });

  it('discards a code for a signed-in user, and asks for a refresh', async () => {
    mockFake.session = { refreshToken: 'here' } as StoredSession;
    const discarded = jest.fn();
    links.onLinkDiscarded(discarded);
    const { flow } = await issue('emailChange');

    await expect(
      links.consumeLink(
        `nhost-starter://account/?flow=${flow}&code=c&type=emailConfirmChange`,
      ),
    ).resolves.toBe('/account');

    expect(mockFake.calls).toEqual([]);
    expect(mockFake.session).toEqual({ refreshToken: 'here' });
    expect(discarded).toHaveBeenCalledTimes(1);
    expect(links.readFlows()[0]?.consumedAt).toEqual(expect.any(Number));
  });

  // The code was issued for another device, or the flow has aged out; either
  // way it signs nobody in here, and whatever it confirmed has happened.
  it.each([
    ['a flow this app never issued', '&flow=unknown'],
    ['no flow', ''],
  ])(
    'discards a code with %s for a signed-in user, with no error',
    async (_, flow) => {
      mockFake.session = { refreshToken: 'here' } as StoredSession;
      const discarded = jest.fn();
      links.onLinkDiscarded(discarded);

      await expect(
        links.consumeLink(
          `nhost-starter://account/?code=c${flow}&type=emailConfirmChange`,
        ),
      ).resolves.toBe('/account');

      expect(mockFake.calls).toEqual([]);
      expect(mockFake.session).toEqual({ refreshToken: 'here' });
      expect(discarded).toHaveBeenCalledTimes(1);
    },
  );

  // Auth's answer to a request without a challenge. Redeeming it would take
  // a session no verifier on this device asked for.
  it.each([
    ['nhost-starter://account/?refreshToken=r&type=emailConfirmChange&a=1'],
    ['nhost-starter://account/?refreshToken=r&flow=x&a=1'],
  ])('drops a refresh token in %s unread', async (url) => {
    await expect(links.consumeLink(url)).resolves.toBe('/account?a=1');

    expect(mockFake.calls).toEqual([]);
    expect(mockFake.session).toBeNull();
  });

  it('drops a refresh token beside a code too', async () => {
    const { flow } = await issue();

    await expect(
      links.consumeLink(
        `nhost-starter://account/?flow=${flow}&code=c&refreshToken=r`,
      ),
    ).resolves.toBe('/account');

    expect(mockFake.calls).toEqual(['exchange', 'set, marker none']);
  });

  // The reset screen then behaves as it does for any signed-in visitor.
  it('lets a reset link for a signed-in user land unconfined', async () => {
    mockFake.session = { refreshToken: 'here' } as StoredSession;
    const { flow } = await issue('passwordReset', '/auth/password/reset');

    await expect(
      links.consumeLink(
        `nhost-starter://auth/password/reset/?flow=${flow}&code=c&type=passwordReset`,
      ),
    ).resolves.toBe('/auth/password/reset');

    expect(mockFake.calls).toEqual([]);
    expect(getDeviceItem(MARKER)).toBeNull();
  });

  it('adds the app error when the trade fails, and stores nothing', async () => {
    mockFake.tokenExchange.mockRejectedValue(new Error('invalid-request'));
    const { flow } = await issue('passwordReset', '/auth/password/reset');

    await expect(
      links.consumeLink(
        `nhost-starter://auth/password/reset/?flow=${flow}&code=c&type=passwordReset`,
      ),
    ).resolves.toBe('/auth/password/reset?error=link-unusable');

    expect(mockFake.session).toBeNull();
    expect(getDeviceItem(MARKER)).toBeNull();
  });

  it('says a verified address is verified when the trade fails', async () => {
    mockFake.tokenExchange.mockResolvedValue({ body: {} });
    const { flow } = await issue('emailVerify');

    await expect(
      links.consumeLink(`nhost-starter://account/?flow=${flow}&code=c`),
    ).resolves.toBe('/account?error=link-email-verified');
  });

  it('gives up on a slow trade, and revokes the session it brings later', async () => {
    jest.useFakeTimers();
    let answer: (value: Exchange) => void = () => undefined;
    mockFake.tokenExchange.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { flow } = await issue('passwordReset', '/auth/password/reset');

    const route = links.consumeLink(
      `nhost-starter://auth/password/reset/?flow=${flow}&code=c&type=passwordReset`,
    );
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(route).resolves.toBe(
      '/auth/password/reset?error=link-unusable',
    );
    expect(getDeviceItem(MARKER)).toBeNull();

    answer(exchanged('late'));
    await jest.runAllTimersAsync();

    expect(mockFake.signOut).toHaveBeenCalledWith({ refreshToken: 'late' });
    expect(mockFake.session).toBeNull();
  });

  it.each([
    ['a flow this app never issued', '&flow=unknown', '', 'link-unusable'],
    ['no flow', '', '', 'link-unusable'],
    [
      'a verification link from another device',
      '&flow=unknown',
      '&type=verifyEmail',
      'link-email-verified',
    ],
  ])('refuses a code with %s', async (_, flow, type, error) => {
    await expect(
      links.consumeLink(`nhost-starter://account/?code=c${flow}${type}`),
    ).resolves.toBe(`/account?error=${error}`);

    expect(mockFake.calls).toEqual([]);
  });

  it("keeps auth's own error, once per flow", async () => {
    const { flow } = await issue();
    const url = `nhost-starter://account/?error=invalid-ticket&errorDescription=Bad+ticket&flow=${flow}`;

    const route = links.consumeLink(url);

    expect(links.consumeLink(`${url}&a=1`)).toBe(route);
    await expect(route).resolves.toBe(
      '/account?error=invalid-ticket&errorDescription=Bad%20ticket',
    );
    expect(links.readFlows()[0]?.consumedAt).toEqual(expect.any(Number));
  });

  it("keeps auth's error on a link with no flow, once per URL", async () => {
    const url = 'nhost-starter:?error=redirectTo-not-allowed';

    const route = links.consumeLink(url);

    expect(links.consumeLink(url)).toBe(route);
    await expect(route).resolves.toBe('/?error=redirectTo-not-allowed');
  });

  it('trades a code delivered twice at once only once', async () => {
    const { flow } = await issue();
    const url = `nhost-starter://account/?flow=${flow}&code=c`;

    const routes = await Promise.all([
      links.consumeLink(url),
      links.consumeLink(url.replace('nhost-starter://account/', '/account')),
    ]);

    expect(routes).toEqual(['/account', '/account']);
    expect(mockFake.tokenExchange).toHaveBeenCalledTimes(1);
  });

  it('never rejects', async () => {
    mockFake.started = Promise.reject(new Error('boom'));

    await expect(
      links.consumeLink('nhost-starter://account/?code=c&flow=x&type=t'),
    ).resolves.toBe('/account');
  });
});

describe('a link delivered again after the process died', () => {
  // Android hands a relaunch from recents the intent that first opened it.
  it('strips a used flow silently, and stays put unless it opens the app', async () => {
    const { flow } = await issue();
    const url = `nhost-starter://account/?flow=${flow}&code=c`;
    await links.consumeLink(url);
    mockFake.session = null;

    const relaunched = load();

    await expect(
      relaunched.redirectSystemPath({ path: url, initial: false }),
    ).resolves.toBeNull();
    await expect(relaunched.consumeLink(url)).resolves.toBe('/account');
    await expect(
      load().redirectSystemPath({ path: url, initial: true }),
    ).resolves.toBe('/account');
    expect(mockFake.tokenExchange).toHaveBeenCalledTimes(1);
  });

  it("drops auth's error too", async () => {
    const { flow } = await issue();
    const url = `nhost-starter://account/?error=invalid-ticket&flow=${flow}`;
    await links.consumeLink(url);

    await expect(load().consumeLink(url)).resolves.toBe('/account');
  });
});

describe('redirectSystemPath', () => {
  it('stays put for a link this process already has', async () => {
    jest.useFakeTimers();
    const { flow } = await issue();
    const url = `nhost-starter://account/?flow=${flow}&code=c`;
    mockFake.tokenExchange.mockReturnValue(new Promise(() => undefined));
    void links.consumeLink(url);

    await expect(
      links.redirectSystemPath({ path: url, initial: false }),
    ).resolves.toBeNull();
  });

  // Pushed over the screen the link was asked for from, the sign-in screens
  // would stay under the account.
  it('opens a link that arrives while the app runs with nothing under it', async () => {
    const { flow } = await issue();

    await expect(
      links.redirectSystemPath({
        path: `nhost-starter://account/?flow=${flow}&code=c`,
        initial: false,
      }),
    ).resolves.toBeNull();

    expect(mockGoTo).toHaveBeenCalledWith('/account');
    expect(mockFake.session).not.toBeNull();
  });

  it('starts the app on the route of the link that opened it', async () => {
    const { flow } = await issue();

    await expect(
      links.redirectSystemPath({
        path: `nhost-starter://account/?flow=${flow}&code=c`,
        initial: true,
      }),
    ).resolves.toBe('/account');

    expect(mockGoTo).not.toHaveBeenCalled();
  });

  it('leaves a link without a code to Expo Router', async () => {
    await expect(
      links.redirectSystemPath({
        path: 'nhost-starter://account?tab=1',
        initial: false,
      }),
    ).resolves.toBe('/account?tab=1');

    expect(mockGoTo).not.toHaveBeenCalled();
  });

  it('opens the root for anything it cannot read', async () => {
    await expect(
      links.redirectSystemPath({ path: 'https://example.com', initial: true }),
    ).resolves.toBe('/');
  });
});

describe('settleInitialLink', () => {
  it('settles once the link that opened the app is handled', async () => {
    let start: VoidFunction = () => undefined;
    mockFake.started = new Promise((resolve) => {
      start = resolve;
    });
    const { flow } = await issue();
    mockFake.initialURL = `nhost-starter://account/?flow=${flow}&code=c`;
    const settled = jest.fn();

    void links.settleInitialLink().then(settled);
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();

    start();
    await links.settleInitialLink();
    expect(settled).toHaveBeenCalled();
    expect(mockFake.tokenExchange).toHaveBeenCalledTimes(1);
  });

  it('settles at once without a link', async () => {
    mockFake.started = new Promise(() => undefined);

    await expect(links.settleInitialLink()).resolves.toBeUndefined();
  });
});

describe('the flow list', () => {
  const ids = () => links.readFlows().map((flow) => flow.id);

  it('keeps the newest ten, all pending', async () => {
    const issued: string[] = [];
    for (let i = 0; i < 12; i++) {
      issued.push((await issue()).flow);
    }

    expect(ids()).toEqual(issued.slice(2));
  });

  it('evicts the flow used longest ago before any pending one', async () => {
    jest.useFakeTimers({ now: 1_000_000, doNotFake: ['nextTick'] });
    const issued: string[] = [];
    for (let i = 0; i < 10; i++) {
      issued.push((await issue()).flow);
    }
    for (const index of [3, 1]) {
      jest.advanceTimersByTime(1000);
      await links.consumeLink(
        `nhost-starter://account?error=x&flow=${issued[index]}`,
      );
    }

    const next = (await issue()).flow;
    expect(ids()).not.toContain(issued[3]);
    expect(ids()).toContain(issued[1]);

    await issue();
    expect(ids()).not.toContain(issued[1]);

    await issue();
    expect(ids()).not.toContain(issued[0]);
    expect(ids()).toContain(next);
  });

  it('forgets flows older than a week', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const { flow } = await issue();
    jest.advanceTimersByTime(links.FLOW_MAX_AGE_MS);

    expect(links.readFlows()).toEqual([]);
    await expect(
      links.consumeLink(`nhost-starter://account/?flow=${flow}&code=c`),
    ).resolves.toBe('/account?error=link-unusable');
  });

  it('fits in one SecureStore value', async () => {
    for (let i = 0; i < 10; i++) {
      await issue('passwordReset', '/auth/password/reset');
    }
    const size = () =>
      new TextEncoder().encode(mockDevice().secureStore.get(FLOWS) ?? '')
        .length;
    const pending = size();
    await Promise.all(
      links
        .readFlows()
        .slice(0, 5)
        .map((flow) =>
          links.consumeLink(`nhost-starter://account?error=x&flow=${flow.id}`),
        ),
    );

    expect(pending).toBeLessThan(2048);
    expect(size()).toBeLessThan(2048);
  });

  it('drops the verifier of a used flow', async () => {
    const { flow } = await issue();
    await links.consumeLink(`nhost-starter://account?error=x&flow=${flow}`);

    expect(links.readFlows()[0]).not.toHaveProperty('verifier');
  });

  it('reads an unreadable list as empty', async () => {
    setDeviceItem(FLOWS, '{not json');

    expect(links.readFlows()).toEqual([]);
    await issue();
    expect(links.readFlows()).toHaveLength(1);
  });

  it('puts the flow in redirectTo on the app scheme', async () => {
    const { redirectTo, flow } = await issue('signIn', '/account?tab=1');

    expect(flow).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(redirectTo).toBe(`nhost-starter://account?tab=1&flow=${flow}`);
  });
});
