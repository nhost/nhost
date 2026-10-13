import type { User } from '@nhost/nhost-js/auth';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Account from '@/app/account/page';
import { methods } from '@/app/signin/methods';

const getVerifiedUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({ getVerifiedUser }));

// Next's redirect() throws to unwind the render; the stand-in throws the
// target so a test can read it. The router is for the client cards on the
// page, which a static render has no app router to give.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
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

  // Read from the registry rather than spelled out, so this test names no
  // method and survives any of them being deleted.
  it('links to every account entry the sign-in methods declare', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);

    const html = renderToStaticMarkup(await Account());

    for (const method of methods) {
      if (method.account) {
        expect(html).toContain(`href="${method.account.href}"`);
        expect(html).toContain(method.account.title);
      }
    }
  });

  it('says two-factor is off until the auth service says otherwise', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);
    expect(renderToStaticMarkup(await Account())).toContain('Off');

    getVerifiedUser.mockResolvedValueOnce({ ...user, activeMfaType: 'totp' });
    expect(renderToStaticMarkup(await Account())).toContain('On (totp)');
  });
});
