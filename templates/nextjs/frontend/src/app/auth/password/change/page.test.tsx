import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChangePassword from '@/app/auth/password/change/page';

const getVerifiedUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({ getVerifiedUser }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

describe('change password page', () => {
  beforeEach(() => {
    getVerifiedUser.mockReset();
  });

  // Not in the proxy's protected list, so this is the only guard it has.
  it('sends a visitor the auth service does not vouch for to sign in', async () => {
    getVerifiedUser.mockResolvedValueOnce(null);

    await expect(ChangePassword()).rejects.toThrow(
      'redirect:/signin?next=%2Fauth%2Fpassword%2Fchange',
    );
  });

  // The form asks for a new password twice and nothing else, which looks
  // like an omission until the page says why.
  it('says why the current password is not asked for', async () => {
    getVerifiedUser.mockResolvedValueOnce({ id: 'a' });

    const html = renderToStaticMarkup(await ChangePassword());

    expect(html).toContain(
      'Being signed in authorises the change, so the current password is not asked for.',
    );
  });

  it('offers the way back to the account page', async () => {
    getVerifiedUser.mockResolvedValueOnce({ id: 'a' });

    const html = renderToStaticMarkup(await ChangePassword());

    expect(html).toContain('href="/account"');
  });
});
