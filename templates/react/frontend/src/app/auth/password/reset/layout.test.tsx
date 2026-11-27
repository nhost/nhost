// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordLayout from '@/app/auth/password/reset/layout';
import ResetPasswordForm from '@/app/auth/password/reset/ResetPasswordForm';

const setNewPassword = vi.hoisted(() =>
  vi.fn<() => Promise<{ error?: string; success?: boolean }>>(),
);

const signOut = vi.hoisted(() => vi.fn<() => Promise<{ error?: string }>>());

vi.mock('@/app/auth/password/actions', () => ({ setNewPassword }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let path = '';

function Where() {
  path = useLocation().pathname;
  return null;
}

async function render(page: ReactNode): Promise<void> {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/auth/password/reset']}>
        <ResetPasswordLayout>{page}</ResetPasswordLayout>
        <Where />
      </MemoryRouter>,
    ),
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

    expect(container.textContent).toContain('Password changed');

    // What the page renders once the change has cleared the session.
    await render(<p>This link no longer works</p>);

    expect(container.textContent).toContain('Password changed');
    expect(container.textContent).not.toContain('This link no longer works');
  });

  // The guard keeps a reset link's session on this page until a password is
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
    expect(path).toBe('/');
  });
});
