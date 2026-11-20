// @vitest-environment happy-dom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import ProviderRedirect from '@/app/auth/oauth/[provider]/page';
import { lastUsedSignIn, promoteSignInAttempt } from '@/app/signin/lastUsed';
import { appOrigin } from '@/lib/nhost/env';

// The SDK's own URL builder, so the query the auth service would receive is
// the real one.
vi.mock('@/lib/nhost/client', async () => {
  const { createClient } = await import('@nhost/nhost-js');
  return {
    nhost: createClient({ subdomain: 'local', region: 'local' }),
  };
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let replace: MockInstance<Location['replace']>;

const visit = async (provider: string, query = ''): Promise<void> => {
  await act(async () =>
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/auth/oauth/${provider}${query}`]}>
          <Routes>
            <Route
              path="/auth/oauth/:provider"
              element={<ProviderRedirect />}
            />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    ),
  );
};

const sentTo = (): URL => new URL(String(replace.mock.calls[0]?.[0]));

describe('provider page', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_NHOST_OAUTH_PROVIDERS', 'google');
    window.localStorage.clear();
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

  // Replaced rather than pushed, so Back from the provider skips this page
  // instead of landing on it and being sent straight back.
  it('leaves for the provider once, in place of this page', async () => {
    await visit('google');

    expect(replace).toHaveBeenCalledOnce();
    expect(sentTo().pathname).toBe('/v1/signin/provider/google');
  });

  // `next` is attacker-controlled; it is held to a path on this site.
  it('never sends the provider off this origin', async () => {
    await visit('google', '?next=%2F%2Fevil.example');

    expect(sentTo().searchParams.get('redirectTo')).toBe(
      `${appOrigin()}/account`,
    );
  });

  // Otherwise a provider the user authorized before, linked here or not,
  // signs them in without showing anything.
  it('asks the provider to show its account picker', async () => {
    await visit('google');

    expect(sentTo().searchParams.get('upstreamParams[prompt]')).toBe(
      'select_account',
    );
  });

  it('notes the provider as the way the visitor is signing in', async () => {
    await visit('google');
    promoteSignInAttempt();

    expect(lastUsedSignIn()).toBe('/auth/oauth/google');
  });

  it('is not found for a provider the deployment did not set up', async () => {
    await visit('github');

    expect(replace).not.toHaveBeenCalled();
    expect(container.textContent).toContain('This page could not be found.');
  });
});
