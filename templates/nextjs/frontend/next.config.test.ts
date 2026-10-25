import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('next config headers', () => {
  // A later entry overwrites a same-named header from an earlier one, so the
  // avatar entry has to come after the site-wide one to win.
  it('sandboxes the avatar route and keeps it unframeable', async () => {
    const entries = (await nextConfig.headers?.()) ?? [];
    const siteWide = entries.findIndex((entry) => entry.source === '/:path*');
    const avatar = entries.findIndex(
      (entry) => entry.source === '/api/avatar/:id',
    );

    expect(siteWide).toBeGreaterThanOrEqual(0);
    expect(avatar).toBeGreaterThan(siteWide);

    const csp = entries[avatar]?.headers.find(
      (header) => header.key === 'Content-Security-Policy',
    )?.value;
    expect(csp).toContain('sandbox');
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe('next config client cache', () => {
  // Next keeps no dynamic page in the browser by default, and every page here
  // is dynamic, so without this each click renders again on the server.
  it('keeps recently visited pages in the browser', () => {
    expect(nextConfig.experimental?.staleTimes?.dynamic).toBeGreaterThan(0);
  });
});
