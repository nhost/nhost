// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import ProviderConnect from '@/app/auth/oauth/[provider]/connect/page';
import { appOrigin } from '@/lib/nhost/env';

const refreshSession = vi.hoisted(() => vi.fn());

// The SDK's own URL builder, over a session the test sets, so the query the
// auth service would receive is the real one.
vi.mock('@/lib/nhost/client', async () => {
  const { createClient } = await import('@nhost/nhost-js');
  return {
    nhost: {
      auth: createClient({ subdomain: 'local', region: 'local' }).auth,
      refreshSession,
    },
  };
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function Location() {
  const { pathname, search } = useLocation();
  return <p>at {`${pathname}${search}`}</p>;
}

let container: HTMLElement;
let root: Root;
let replace: MockInstance<Location['replace']>;

const visit = async (provider: string): Promise<void> => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[`/auth/oauth/${provider}/connect`]}>
        <Routes>
          <Route
            path="/auth/oauth/:provider/connect"
            element={<ProviderConnect />}
          />
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
};

describe('provider connect page', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_NHOST_OAUTH_PROVIDERS', 'github');
    refreshSession.mockReset();
    refreshSession.mockResolvedValue({ accessToken: 'access-token' });
    replace = vi
      .spyOn(window.location, 'replace')
      .mockImplementation(() => undefined);
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
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
    expect(container.textContent).toBe('at /signin?next=%2Faccount');
  });

  it('is not found for a provider the deployment did not set up', async () => {
    await visit('google');

    expect(refreshSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain('This page could not be found.');
  });
});
