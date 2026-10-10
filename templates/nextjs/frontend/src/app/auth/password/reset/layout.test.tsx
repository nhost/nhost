// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordLayout from '@/app/auth/password/reset/layout';
import ResetPasswordForm from '@/app/auth/password/reset/ResetPasswordForm';

const setNewPassword = vi.hoisted(() =>
  vi.fn<() => Promise<{ error?: string; success?: boolean }>>(),
);

vi.mock('@/app/auth/password/actions', () => ({ setNewPassword }));

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

  it('keeps a refused change on the form and says why', async () => {
    setNewPassword.mockResolvedValue({ error: 'Password is too short' });
    await render(<ResetPasswordForm />);

    await submit('short');

    expect(container.innerText).toContain('Password is too short');
    expect(container.innerText).not.toContain('Password changed');
    expect(container.querySelector('button')?.disabled).toBe(false);
  });
});
