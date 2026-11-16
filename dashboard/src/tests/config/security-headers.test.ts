import { createRequire } from 'node:module';
import { resolve } from 'node:path';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const requireConfig = createRequire(import.meta.url);
const nextConfig = requireConfig(resolve('next.config.js')) as {
  headers: () => Promise<HeaderRule[]>;
};

async function contentSecurityPolicy() {
  const rules = await nextConfig.headers();
  return rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy')?.value;
}

beforeEach(() => {
  vi.stubEnv('CSP_MODE', 'nhost');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('dashboard security headers', () => {
  it('keeps CSP enabled without upgrading HTTP development assets to HTTPS', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const policy = await contentSecurityPolicy();
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain('upgrade-insecure-requests');
    const rules = await nextConfig.headers();
    expect(rules[0].headers).toContainEqual({
      key: 'X-Frame-Options',
      value: 'DENY',
    });
  });

  it('continues to enforce HTTPS upgrades in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(await contentSecurityPolicy()).toContain(
      'upgrade-insecure-requests',
    );
  });

  it('preserves an explicitly configured custom policy', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CSP_MODE', 'custom');
    vi.stubEnv('CSP_HEADER', "default-src 'self'; upgrade-insecure-requests;");
    expect(await contentSecurityPolicy()).toBe(
      "default-src 'self'; upgrade-insecure-requests;",
    );
  });

  it('preserves the explicit CSP disable option', async () => {
    vi.stubEnv('CSP_MODE', 'disabled');
    expect(await nextConfig.headers()).toEqual([]);
  });
});
