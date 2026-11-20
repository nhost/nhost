import type { Session } from '@nhost/nhost-js/auth';
import { redirectSystemPath } from '@/app/+native-intent';
import { startFlow } from '@/lib/nhost/links';

jest.mock('@/lib/nhost/startSession', () => ({
  START_TIMEOUT_MS: 10_000,
  startSession: async () => undefined,
}));

jest.mock('@/lib/nhost/client', () => ({
  ...jest.requireActual('@/lib/nhost/client'),
  bareAuth: () => ({
    tokenExchange: async () => ({
      body: { session: { refreshToken: 'from-link' } as Session },
    }),
  }),
  nhost: {
    getUserSession: () => null,
    sessionStorage: { set: () => undefined },
  },
}));

const mockOpened: string[] = [];

jest.mock('@/lib/goTo', () => ({
  goTo: (href: string) => mockOpened.push(href),
}));

const LINK_PARAMS = /[?&](code|type|flow|refreshToken)=/;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('+native-intent', () => {
  it('never hands a code, type, flow or refresh token on to a route', async () => {
    const { redirectTo } = await startFlow(
      'passwordReset',
      '/auth/password/reset',
    );
    const issued = redirectTo.replace('reset?', 'reset/?');
    const paths = [
      `${issued}&code=c&type=passwordReset`,
      `${issued}&code=c&type=passwordReset`,
      'nhost-starter:///account?code=x&flow=y',
      'nhost-starter://account/?code=x&flow=y&type=verifyEmail&tab=1',
      'nhost-starter://account/?error=invalid-ticket&flow=z&type=t',
      'nhost-starter://account?flow=f&type=t',
      'nhost-starter://account/?refreshToken=r&type=emailConfirmChange',
      'nhost-starter://account/?code=x&refreshToken=r',
      '/account?code=bare&flow=q',
      'nhost-starter:?error=x&code=k',
      'nhost-starter://',
      'not a link',
    ];

    for (const initial of [true, false]) {
      for (const path of paths) {
        mockOpened.length = 0;
        const route = await redirectSystemPath({ path, initial });
        for (const opened of [route ?? '', ...mockOpened]) {
          expect(opened).not.toMatch(LINK_PARAMS);
        }
      }
    }
  });

  it('sends an unknown code to its screen with the app error', async () => {
    await expect(
      redirectSystemPath({
        path: 'nhost-starter:///account?code=x&flow=unknown',
        initial: true,
      }),
    ).resolves.toBe('/account?error=link-unusable');
  });
});
