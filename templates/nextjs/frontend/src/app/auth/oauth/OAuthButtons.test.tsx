import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OAuthButtons from '@/app/auth/oauth/OAuthButtons';
import { providers } from '@/app/auth/oauth/providers';

const render = (links: { id: string; label: string; href: string }[]): string =>
  renderToStaticMarkup(<OAuthButtons links={links} />);

const linksFor = (ids: string[]) =>
  ids.map((id) => ({ id, label: `Continue with ${id}`, href: `/auth/${id}` }));

describe('OAuthButtons', () => {
  it('sends the visitor to the auth service, not through the router', () => {
    const html = render(linksFor(['github']));

    expect(html).toContain('href="/auth/github"');
    expect(html).toContain('Continue with github');
  });

  // Read from the registry, so a provider added there without a mark is
  // caught here rather than noticed on the page.
  it('gives every provider it offers a mark', () => {
    const html = render(
      providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        href: `/auth/${provider.id}`,
      })),
    );

    for (const provider of providers) {
      expect(html).toContain(provider.label);
    }
    expect(html.match(/<svg/g)).toHaveLength(providers.length);
  });

  // The mark is decoration beside a label that already names the provider,
  // so it is hidden rather than read out twice.
  it('hides the mark from a screen reader', () => {
    const html = render(linksFor(['github']));

    expect(html).toContain('aria-hidden="true"');
  });

  // Unknown ids render no mark rather than throwing, so a provider can be
  // added to nhost.toml and the registry before anyone draws its logo.
  it('falls back to the label alone for a provider it has no mark for', () => {
    const html = render(linksFor(['bitbucket']));

    expect(html).toContain('Continue with bitbucket');
    expect(html).not.toContain('<svg');
  });
});
