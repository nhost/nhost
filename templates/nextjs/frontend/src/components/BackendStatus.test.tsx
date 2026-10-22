import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BackendStatus from '@/components/BackendStatus';

describe('BackendStatus', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the local backend and links its dashboard', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', '');

    const html = renderToStaticMarkup(<BackendStatus />);

    expect(html).toContain('Nhost Local');
    expect(html).toContain('href="https://local.dashboard.local.nhost.run"');
  });

  it('links the cloud project when its organization is known', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');
    vi.stubEnv('NEXT_PUBLIC_NHOST_ORG_SLUG', 'acme');

    const html = renderToStaticMarkup(<BackendStatus />);

    expect(html).toContain('Nhost Cloud');
    expect(html).toContain(
      'href="https://app.nhost.io/orgs/acme/projects/abcdefgh"',
    );
  });

  // The dashboard has no URL that finds a project from its subdomain, so the
  // subdomain is kept on the link for picking it there.
  it('links the project picker when the organization is not set', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');
    vi.stubEnv('NEXT_PUBLIC_NHOST_ORG_SLUG', '');

    const html = renderToStaticMarkup(<BackendStatus />);

    expect(html).toContain('Nhost Cloud');
    expect(html).toContain('title="abcdefgh in eu-central-1"');
    expect(html).toContain('href="https://app.nhost.io/orgs/_/projects/_"');
  });
});
