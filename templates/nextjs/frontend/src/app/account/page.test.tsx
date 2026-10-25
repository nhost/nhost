import type { User } from '@nhost/nhost-js/auth';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Account from '@/app/account/page';

const getVerifiedUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({ getVerifiedUser }));

// A registry of made-up methods, so this test names no real one and survives
// any of them being deleted: one with a setting on the account page, one
// with nothing to configure.
vi.mock('@/app/signin/methods', () => ({
  methods: [
    {
      href: '/auth/configurable',
      title: 'Configurable',
      description: '',
      account: {
        thing: ({ user }: { user: User }) => <li>Setting for {user.id}</li>,
      },
    },
    { href: '/auth/plain', title: 'Plain method', description: '' },
  ],
}));

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
    expect(html).toContain('Ada');
    expect(html).toContain('Joined Oct 13, 2026');
    // Cut short on the chip, and whole in its tooltip.
    expect(html).toContain(`title="${user.id}"`);
    expect(html).toContain('src="https://avatars.example/ada"');
  });

  it('renders the settings each sign-in method declares, given the user', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);

    const html = renderToStaticMarkup(await Account());

    expect(html).toContain(`<li>Setting for ${user.id}</li>`);
  });

  it('leads the settings with the address, its dialog shut', async () => {
    getVerifiedUser.mockResolvedValueOnce({ ...user, emailVerified: false });

    const html = renderToStaticMarkup(await Account());

    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('not verified');
    expect(html).not.toContain('New email');
  });

  it('says where the page and its settings live in the starter', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);

    const html = renderToStaticMarkup(await Account());

    expect(html).toContain('src/app/account/');
    expect(html).toContain('src/app/auth/');
  });

  // The point of the section: a method with nothing to configure is still
  // named, so the page answers how else this account can sign in.
  it('names the methods that have nothing to configure', async () => {
    getVerifiedUser.mockResolvedValueOnce(user);

    const html = renderToStaticMarkup(await Account());

    expect(html).toContain(
      'Plain method also signs in to this account, with nothing to set up here.',
    );
  });
});
