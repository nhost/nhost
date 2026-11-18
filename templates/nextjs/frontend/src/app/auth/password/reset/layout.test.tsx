// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordLayout from '@/app/auth/password/reset/layout';
import ResetPasswordForm from '@/app/auth/password/reset/ResetPasswordForm';

const setNewPassword = vi.hoisted(() =>
  vi.fn<() => Promise<{ error?: string; success?: boolean }>>(),
);

const signOut = vi.hoisted(() => vi.fn<() => Promise<{ error?: string }>>());
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('@/app/auth/password/actions', () => ({ setNewPassword }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function render(page: ReactNode): Promise<void> {
  await act(async () =>
    root.render(<ResetPasswordLayout>{page}</ResetPasswordLayout>),
  );
}

// React reads a controlled input through its own setter, so the value is set
// past it and announced the way typing does.
function type(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function submit(password: string): Promise<void> {
  await act(async () => {
    for (const input of container.querySelectorAll('input')) {
      type(input, password);
    }
  });
  await act(async () => container.querySelector('button')?.click());
}

describe('password reset layout, through a change', () => {
  beforeEach(() => {
    setNewPassword.mockReset();
    signOut.mockReset();
    router.push.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the changed card when the page comes back without a session', async () => {
    setNewPassword.mockResolvedValue({ success: true });
    await render(<ResetPasswordForm />);

    await submit('a new password');

    expect(container.innerText).toContain('Password changed');

    // What Next renders under the layout once the action has cleared the
    // session.
    await render(<p>This link no longer works</p>);

    expect(container.innerText).toContain('Password changed');
    expect(container.innerText).not.toContain('This link no longer works');
  });

  // The proxy keeps a reset link's session on this page until a password is
  // saved, so this is the one way off it without one.
  it('signs out and goes home on cancel', async () => {
    signOut.mockResolvedValue({});
    await render(<ResetPasswordForm />);

    const cancel = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Cancel',
    );
    await act(async () => cancel?.click());

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(setNewPassword).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/');
  });
});
