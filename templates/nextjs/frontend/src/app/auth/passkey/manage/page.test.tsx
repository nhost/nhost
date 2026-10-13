import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Manage from '@/app/auth/passkey/manage/page';

const getVerifiedUser = vi.hoisted(() => vi.fn());
const listPasskeys = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({ getVerifiedUser }));
vi.mock('@/app/auth/passkey/manage/actions', () => ({ listPasskeys }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  useRouter: () => ({ refresh: () => undefined }),
}));

describe('passkeys page', () => {
  beforeEach(() => {
    getVerifiedUser.mockReset();
    listPasskeys.mockReset();
  });

  // Not in the proxy's protected list, so this is the only guard it has.
  it('sends a visitor the auth service does not vouch for to sign in', async () => {
    getVerifiedUser.mockResolvedValueOnce(null);

    await expect(Manage()).rejects.toThrow(
      'redirect:/signin?next=%2Fauth%2Fpasskey%2Fmanage',
    );
    expect(listPasskeys).not.toHaveBeenCalled();
  });

  it('lists the keys by nickname', async () => {
    getVerifiedUser.mockResolvedValueOnce({ id: 'u' });
    listPasskeys.mockResolvedValueOnce({
      keys: [
        { id: 'k1', credentialId: 'c1', nickname: 'laptop' },
        { id: 'k2', credentialId: 'abcdefghijklmnopqrst', nickname: null },
      ],
    });

    const html = renderToStaticMarkup(await Manage());

    expect(html).toContain('laptop');
    expect(html).toContain('abcdefghijklmnop');
  });

  it('shows the list error instead of the form', async () => {
    getVerifiedUser.mockResolvedValueOnce({ id: 'u' });
    listPasskeys.mockResolvedValueOnce({ error: 'not applied' });

    const html = renderToStaticMarkup(await Manage());

    expect(html).toContain('not applied');
    expect(html).not.toContain('Add a passkey');
  });
});
