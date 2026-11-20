// @vitest-environment happy-dom
import type { User } from '@nhost/nhost-js/auth';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Account from '@/app/account/page';
import { useRefresh } from '@/components/useRefresh';
import AuthProvider from '@/lib/nhost/AuthProvider';

const getVerifiedUser = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/client', () => ({
  getVerifiedUser,
  nhost: { getUserSession: () => null, sessionStorage: { remove } },
}));

vi.mock('@/lib/nhost/watchSession', () => ({
  watchSession: () => ({ checkRevoked: async () => undefined, stop: vi.fn() }),
}));

// A registry of made-up methods, so this test names no real one and survives
// any of them being deleted: one with a setting on the account page, one with
// nothing to configure.
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
  buttonSettings: [
    ({ user }: { user: User }) => <li>Button setting for {user.id}</li>,
  ],
}));

// It loads the sessions over GraphQL; its own tests cover it.
vi.mock('@/app/account/SessionsCard', () => ({
  default: () => <section>Sessions card</section>,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

let refresh: VoidFunction = () => undefined;

function AccountWithRefresh() {
  refresh = useRefresh();
  return <Account />;
}

let container: HTMLElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;

async function open(): Promise<void> {
  router = createMemoryRouter(
    [
      {
        element: (
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        ),
        children: [
          { path: '/account', element: <AccountWithRefresh /> },
          { path: '/signin', element: <p>sign in</p> },
        ],
      },
    ],
    { initialEntries: ['/account'] },
  );
  await act(async () => root.render(<RouterProvider router={router} />));
}

const at = (): string =>
  `${router.state.location.pathname}${router.state.location.search}`;

describe('account page', () => {
  beforeEach(() => {
    getVerifiedUser.mockReset();
    remove.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders the settings each sign-in method declares, given the user', async () => {
    getVerifiedUser.mockResolvedValue({ user });

    await open();

    expect(container.innerHTML).toContain(`<li>Setting for ${user.id}</li>`);
    expect(container.innerHTML).toContain(
      `<li>Button setting for ${user.id}</li>`,
    );
    expect(container.textContent).toContain(
      'Plain method also signs in to this account',
    );
  });

  it('shows the profile, the sessions and a way to close the account', async () => {
    getVerifiedUser.mockResolvedValue({ user });

    await open();

    expect(container.textContent).toContain(user.displayName);
    expect(container.textContent).toContain(user.id);
    expect(container.textContent).toContain('Sessions card');
    expect(container.textContent).toContain('Delete account');
  });

  // A stored session anyone could have written gets this far; the auth
  // service is what turns it down.
  it('clears a session the auth service refuses and sends the visitor to sign in', async () => {
    getVerifiedUser.mockResolvedValue({ user: null, reason: 'rejected' });

    await open();

    expect(remove).toHaveBeenCalled();
    expect(at()).toBe('/signin?next=%2Faccount');
  });

  // Sent to sign in with the session kept, the visitor would come straight
  // back, for as long as the outage lasts.
  it('shows an error and stays when the auth service cannot answer', async () => {
    getVerifiedUser.mockResolvedValue({ user: null, reason: 'unavailable' });

    await open();

    expect(remove).not.toHaveBeenCalled();
    expect(at()).toBe('/account');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load your account',
    );
  });

  it('keeps the account on screen when a reload comes back empty', async () => {
    getVerifiedUser.mockResolvedValueOnce({ user });
    await open();

    getVerifiedUser.mockResolvedValueOnce({ user: null, reason: 'rejected' });
    await act(async () => refresh());

    expect(getVerifiedUser).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalled();
    expect(at()).toBe('/account');
    expect(container.textContent).toContain(user.email);
  });
});
