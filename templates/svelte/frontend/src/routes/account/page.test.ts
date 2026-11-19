import type { User } from '@nhost/nhost-js/auth';
import { isRedirect } from '@sveltejs/kit';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server.ts';
import Account from './+page.svelte';

const getVerifiedUser = vi.hoisted(() => vi.fn());

vi.mock('#lib/nhost/server.ts', () => ({ getVerifiedUser }));

// A registry of made-up methods, so this test names no real one and survives
// any of them being deleted: one with a setting on the account page, one with
// nothing to configure.
vi.mock('#routes/signin/methods.ts', async () => ({
  methods: [
    {
      href: '/auth/configurable',
      title: 'Configurable',
      description: '',
      account: {
        thing: (await import('#lib/testing/SettingProbe.svelte')).default,
      },
    },
    { href: '/auth/plain', title: 'Plain method', description: '' },
  ],
  buttonSettings: [],
}));

// The remote functions the page's rows call, none of which a render reaches
// but the sessions query.
vi.mock('./actions.remote.ts', async () => ({
  ...(await import('#lib/testing/remoteForm.ts').then(({ fakeForm }) => ({
    uploadAvatar: fakeForm().form,
  }))),
  listSessions: async () => ({ sessions: [] }),
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

    const loaded = (load as () => Promise<unknown>)();

    await expect(loaded).rejects.toSatisfy(
      (err) => isRedirect(err) && err.location === '/signin?next=%2Faccount',
    );
  });

  it('renders the settings each sign-in method declares, given the user', async () => {
    const { body } = await render(Account, {
      props: { data: { user }, params: {} } as never,
    });

    expect(body).toContain(`Setting for ${user.id}`);
    expect(body).toContain('Plain method also signs in to this account');
  });
});
