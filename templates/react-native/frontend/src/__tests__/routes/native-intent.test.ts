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

const LINK_PARAMS = /[?&](code|type|flow)=/;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('+native-intent', () => {
  it('never hands a code, type or flow on to a route', async () => {
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
      '/account?code=bare&flow=q',
      'nhost-starter:?error=x&code=k',
      'nhost-starter://',
      'not a link',
    ];

    for (const initial of [true, false]) {
      for (const path of paths) {
        const route = await redirectSystemPath({ path, initial });
        expect(route ?? '').not.toMatch(LINK_PARAMS);
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
