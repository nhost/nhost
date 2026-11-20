// @vitest-environment happy-dom
import type { User } from '@nhost/nhost-js/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import LinkedAccountsSetting from '@/app/auth/oauth/linked/LinkedAccountsSetting.vue';
import SettingsList from '@/components/SettingsList.vue';
import { createAuth } from '@/lib/nhost/auth';
import { type Mounted, mountAt, routerAt } from '@/test/mount';

const listLinkedAccounts = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/oauth/linked/actions', () => ({ listLinkedAccounts }));
vi.mock('@/lib/nhost/watchSession', () => ({
  watchSession: () => ({ checkRevoked: async () => undefined, stop: vi.fn() }),
}));

const user = { id: 'user-1', email: 'user@example.com' } as User;

let mounted: Mounted;

async function render(): Promise<void> {
  const router = await routerAt('/account');
  mounted = await mountAt(
    () => h(SettingsList, () => h(LinkedAccountsSetting, { user })),
    '/account',
    { router, plugins: [createAuth({ router, recheck: () => undefined })] },
  );
}

const row = (): string => mounted.el.querySelector('li')?.textContent ?? '';

describe('linked accounts setting', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_NHOST_OAUTH_PROVIDERS', 'github,google');
    listLinkedAccounts.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Before the list arrives the row offers neither "None" nor "Add", which
  // would be wrong for an account that has links.
  it('says it is loading until the list arrives', async () => {
    listLinkedAccounts.mockReturnValueOnce(new Promise(() => undefined));

    await render();

    expect(row()).toContain('Loading…');
    expect(row()).not.toContain('None');
  });

  it('names the providers the account is linked to', async () => {
    listLinkedAccounts.mockResolvedValueOnce({
      links: [
        { id: 'l1', providerId: 'github', createdAt: '2026-10-01T00:00:00Z' },
      ],
    });

    await render();

    expect(row()).toContain('GitHub');
    expect(row()).not.toContain('Google');
    expect(row()).toContain('Manage');
  });
});
