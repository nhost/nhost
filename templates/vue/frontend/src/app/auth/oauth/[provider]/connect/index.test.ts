// @vitest-environment happy-dom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { h } from 'vue';
import { createMemoryHistory, type Router, RouterView } from 'vue-router';
import { appOrigin } from '@/lib/nhost/env';
import { createAppRouter } from '@/router';
import { type Mounted, mountAt } from '@/test/mount';

const refreshSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/client', async () => {
  const { createClient } = await import('@nhost/nhost-js');
  return {
    nhost: {
      auth: createClient({ subdomain: 'local', region: 'local' }).auth,
      refreshSession,
    },
  };
});

// The sign-in page it may land on reads the session.
vi.mock('@/lib/nhost/auth', async () => {
  const { computed } = await import('vue');
  return { useSession: () => computed(() => null) };
});

let mounted: Mounted;
let router: Router;
let replace: MockInstance<Location['replace']>;

async function visit(provider: string): Promise<void> {
  const path = `/auth/oauth/${provider}/connect`;
  router = createAppRouter(createMemoryHistory());
  await router.push(path);
  mounted = await mountAt(() => h(RouterView), path, { router });
}

describe('provider connect page', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_NHOST_OAUTH_PROVIDERS', 'github');
    refreshSession.mockReset();
    refreshSession.mockResolvedValue({ accessToken: 'access-token' });
    replace = vi
      .spyOn(window.location, 'replace')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('sends the session to the provider as the account to connect to', async () => {
    await visit('github');

    expect(refreshSession).toHaveBeenCalledWith(60);
    const location = new URL(String(replace.mock.calls[0]?.[0]));
    expect(location.pathname).toBe('/v1/signin/provider/github');
    expect(location.searchParams.get('connect')).toBe('access-token');
    expect(location.searchParams.get('redirectTo')).toBe(
      `${appOrigin()}/account`,
    );
  });

  it('sends a signed-out visitor to sign in first', async () => {
    refreshSession.mockResolvedValue(null);

    await visit('github');

    expect(replace).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/signin');
    expect(router.currentRoute.value.query.next).toBe('/account');
  });

  it('is not found for a provider the deployment did not set up', async () => {
    await visit('google');

    expect(refreshSession).not.toHaveBeenCalled();
    expect(mounted.el.textContent).toContain('This page could not be found.');
  });
});
