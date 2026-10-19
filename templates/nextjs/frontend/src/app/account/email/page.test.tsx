import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Email from '@/app/account/email/page';

const getVerifiedUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({ getVerifiedUser }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const user = {
  id: 'user-1',
  email: 'user@example.com',
  emailVerified: true,
};

describe('email page', () => {
  beforeEach(() => {
    getVerifiedUser.mockReset();
  });

  // Under /account, so the proxy turns a signed-out visitor away first.
  // This is the check that the page does not depend on it having run.
  it('sends a visitor the auth service does not vouch for to sign in', async () => {
    getVerifiedUser.mockResolvedValueOnce(null);

    await expect(Email()).rejects.toThrow(
      'redirect:/signin?next=%2Faccount%2Femail',
    );
  });

  // The reason this is a page: submitting changes nothing visible, and
  // without saying so it reads as a failure.
  it('says the change only lands when the link is opened', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);

    const html = renderToStaticMarkup(await Email());

    expect(html).toContain('user@example.com');
    expect(html).toContain(
      'the auth service sends a confirmation link to it, and the account moves when that link is opened',
    );
  });

  it('offers the way back to the account page', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);

    expect(renderToStaticMarkup(await Email())).toContain('href="/account"');
  });
});
