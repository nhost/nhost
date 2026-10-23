import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProviderSignIn from '@/app/auth/oauth/ProviderSignIn';
import { providerHref, providers } from '@/app/auth/oauth/providers';

const render = (
  destination = '/account',
  lastUsed: string | null = null,
): string =>
  renderToStaticMarkup(<ProviderSignIn {...{ destination, lastUsed }} />);

const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) =>
    (m[1] ?? '').replaceAll('&amp;', '&'),
  );

describe('provider sign-in', () => {
  beforeEach(() => {
    vi.stubEnv(
      'NHOST_OAUTH_PROVIDERS',
      providers.map(({ id }) => id).join(','),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('offers every configured provider', () => {
    expect(hrefs(render())).toEqual(
      providers.map(({ id }) => providerHref(id)),
    );
  });

  it('offers only the providers the deployment set up', () => {
    vi.stubEnv('NHOST_OAUTH_PROVIDERS', 'github');

    const html = render();

    expect(html).toContain('Continue with GitHub');
    expect(html).not.toContain('Continue with Google');
  });

  // The route is what hands the destination to the provider, so it has to
  // arrive there.
  it('passes on where the visitor was going', () => {
    for (const href of hrefs(render('/protected'))) {
      expect(new URL(href, 'http://localhost').searchParams.get('next')).toBe(
        '/protected',
      );
    }
  });

  it('marks the provider the visitor last signed in with', () => {
    const html = render('/account', providerHref('google'));

    expect(html).toMatch(/Continue with Google.*Last used/);
    expect(html.match(/Last used/g)).toHaveLength(1);
  });
});
