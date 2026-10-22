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

    expect(html).toContain('Connected to the local backend');
    expect(html).toContain('href="https://local.dashboard.local.nhost.run"');
  });

  // The dashboard has no URL that finds a project from its subdomain, so the
  // subdomain is shown for picking it there.
  it('names a cloud project and links the project picker', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');

    const html = renderToStaticMarkup(<BackendStatus />);

    expect(html).toContain('abcdefgh');
    expect(html).toContain('eu-central-1');
    expect(html).toContain('href="https://app.nhost.io/orgs/_/projects/_"');
  });
});
