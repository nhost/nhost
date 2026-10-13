import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Mfa from '@/app/auth/password/mfa/page';

const getVerifiedUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({ getVerifiedUser }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  useRouter: () => ({ refresh: () => undefined }),
}));

describe('two-factor page', () => {
  beforeEach(() => {
    getVerifiedUser.mockReset();
  });

  // Not in the proxy's protected list, so this is the only guard it has.
  it('sends a visitor the auth service does not vouch for to sign in', async () => {
    getVerifiedUser.mockResolvedValueOnce(null);

    await expect(Mfa()).rejects.toThrow(
      'redirect:/signin?next=%2Fauth%2Fpassword%2Fmfa',
    );
  });

  it('offers to turn two-factor on when it is off', async () => {
    getVerifiedUser.mockResolvedValueOnce({ activeMfaType: undefined });

    const html = renderToStaticMarkup(await Mfa());

    expect(html).toContain('Two-factor is off.');
    expect(html).toContain('Turn on two-factor');
  });

  it('offers to turn two-factor off when it is on', async () => {
    getVerifiedUser.mockResolvedValueOnce({ activeMfaType: 'totp' });

    const html = renderToStaticMarkup(await Mfa());

    expect(html).toContain('Two-factor is on.');
    expect(html).toContain('Turn off two-factor');
  });

  it('says which sign-in it applies to', async () => {
    getVerifiedUser.mockResolvedValueOnce({ activeMfaType: undefined });

    const html = renderToStaticMarkup(await Mfa());

    expect(html).toContain('Other sign-in methods are not challenged.');
  });
});
