import type { User } from '@nhost/nhost-js/auth';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Account from '@/app/account/page';

const getVerifiedUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({ getVerifiedUser }));

// Next's redirect() throws to unwind the render; the stand-in throws the
// target so a test can read it.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const user: User = {
  id: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
  email: 'user@example.com',
  emailVerified: true,
  displayName: 'Ada',
  avatarUrl: 'https://avatars.example/ada',
  roles: ['user', 'me'],
  defaultRole: 'user',
  locale: 'en',
  isAnonymous: false,
  metadata: {},
  phoneNumberVerified: false,
  createdAt: '2026-10-13T16:00:00Z',
};

describe('account page', () => {
  beforeEach(() => {
    getVerifiedUser.mockReset();
  });

  it('sends a visitor the auth service does not vouch for to sign in', async () => {
    getVerifiedUser.mockResolvedValueOnce(null);

    await expect(Account()).rejects.toThrow('redirect:/signin?next=%2Faccount');
  });

  it('shows what the auth service holds for the account', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);

    const html = renderToStaticMarkup(await Account());

    expect(html).toContain('user@example.com');
    expect(html).toContain('(verified)');
    expect(html).toContain('Ada');
    expect(html).toContain('user, me');
    expect(html).toContain('2026-10-13');
    expect(html).toContain(user.id);
    expect(html).toContain('src="https://avatars.example/ada"');
  });

  it('says two-factor is off until the auth service says otherwise', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);
    expect(renderToStaticMarkup(await Account())).toContain('Off');

    getVerifiedUser.mockResolvedValueOnce({ ...user, activeMfaType: 'totp' });
    expect(renderToStaticMarkup(await Account())).toContain('On (totp)');
  });
});
