// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordForm from '@/app/auth/password/PasswordForm';

const router = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/auth/password',
}));

vi.mock('@/app/auth/password/actions', () => ({}));

// Two entries, so "Other ways to sign in" renders. Neither names a method, so
// deleting a method leaves nothing here that names it.
vi.mock('@/app/signin/methods', () => ({
  methods: [{}, {}],
  buttons: [],
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function toggle(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

// "Other ways to sign in" is rendered on the server from the URL, so a mode
// the visitor switched to only reaches it through the URL.
describe('password form, switching modes', () => {
  beforeEach(() => {
    router.replace.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('writes the mode it switched to into the URL, keeping next', async () => {
    await act(async () =>
      root.render(
        <PasswordForm next="/protected" intent="sign-up" mailboxURL={null} />,
      ),
    );

    await toggle('I already have an account');

    expect(router.replace).toHaveBeenLastCalledWith(
      '/auth/password?next=%2Fprotected&intent=sign-in',
      { scroll: false },
    );

    await toggle('Create an account');

    expect(router.replace).toHaveBeenLastCalledWith(
      '/auth/password?next=%2Fprotected',
      { scroll: false },
    );
  });
});
