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

const actions = vi.hoisted(() => ({
  signIn: vi.fn(),
  verifyMfa: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/auth/password',
}));

vi.mock('@/app/auth/password/actions', () => actions);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const input = (label: string): HTMLInputElement | undefined =>
  [...container.querySelectorAll('label')].find(
    (candidate) => candidate.textContent === label,
  )?.control as HTMLInputElement | undefined;

// React listens for `input` and reads the value through the native setter,
// so a plain assignment to `.value` would be invisible to it.
async function type(label: string, value: string): Promise<void> {
  const target = input(label);
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    set?.call(target, value);
    target?.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(): Promise<void> {
  await act(async () =>
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

async function _click(text: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === text,
  );
  await act(async () => button?.click());
}

const hasLabel = (label: string): boolean =>
  [...container.querySelectorAll('label')].some(
    (candidate) => candidate.textContent === label,
  );

describe('password sign-in with two-factor on', () => {
  beforeEach(async () => {
    for (const fn of [...Object.values(router), ...Object.values(actions)]) {
      fn.mockReset();
    }
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <PasswordForm next="/account" intent="sign-in" mailboxURL={null} />,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('asks for the code, then trades it for the session', async () => {
    actions.signIn.mockResolvedValueOnce({ mfaTicket: 'mfaTotp:abc' });
    actions.verifyMfa.mockResolvedValueOnce({ success: true });
    await type('Email', 'user@example.com');
    await type('Password', 'password');

    await submit();

    expect(hasLabel('Authenticator code')).toBe(true);
    expect(hasLabel('Password')).toBe(false);
    expect(router.push).not.toHaveBeenCalled();

    await type('Authenticator code', '123456');
    await submit();

    expect(actions.verifyMfa).toHaveBeenCalledWith('mfaTotp:abc', '123456');
    expect(router.push).toHaveBeenCalledWith('/account');
  });
});
