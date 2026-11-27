// @vitest-environment happy-dom
import type { User } from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import PasskeysSetting from '@/app/auth/passkey/manage/PasskeysSetting.vue';
import SettingsList from '@/components/SettingsList.vue';
import { createAuth } from '@/lib/nhost/auth';
import { type Mounted, mountAt, routerAt } from '@/test/mount';

const listPasskeys = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/passkey/manage/actions', () => ({ listPasskeys }));
vi.mock('@/lib/nhost/watchSession', () => ({
  watchSession: () => ({ checkRevoked: async () => undefined, stop: vi.fn() }),
}));

const user = { id: 'user-1' } as User;

let mounted: Mounted;

async function render(): Promise<void> {
  const router = await routerAt('/account');
  mounted = await mountAt(
    () => h(SettingsList, () => h(PasskeysSetting, { user })),
    '/account',
    { router, plugins: [createAuth({ router, recheck: () => undefined })] },
  );
}

const row = (): string => mounted.el.querySelector('li')?.textContent ?? '';

describe('passkeys setting', () => {
  beforeEach(() => {
    listPasskeys.mockReset();
  });

  // Before the list arrives the row offers neither "None" nor "Add", which
  // would be wrong for an account that has passkeys.
  it('says it is loading until the list arrives', async () => {
    listPasskeys.mockReturnValueOnce(new Promise(() => undefined));

    await render();

    expect(row()).toContain('Loading…');
    expect(row()).not.toContain('None');
  });

  it('shows the names of the passkeys it loaded', async () => {
    listPasskeys.mockResolvedValueOnce({
      keys: [
        { id: 'k1', credentialId: 'c1', nickname: 'laptop' },
        { id: 'k2', credentialId: 'c2', nickname: null },
      ],
    });

    await render();

    expect(row()).toContain('laptop, Passkey 2');
    expect(row()).toContain('Manage');
  });

  it('offers to add one when there are none', async () => {
    listPasskeys.mockResolvedValueOnce({ keys: [] });

    await render();

    expect(row()).toContain('None');
    expect(row()).toContain('Add');
    // The user it is given is a prop, not an attribute on the row.
    expect(mounted.el.querySelector('li')?.hasAttribute('user')).toBe(false);
  });
});
