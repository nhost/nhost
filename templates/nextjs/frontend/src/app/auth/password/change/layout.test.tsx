// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChangePasswordForm from '@/app/auth/password/change/ChangePasswordForm';
import ChangePasswordLayout from '@/app/auth/password/change/layout';

const changePassword = vi.hoisted(() =>
  vi.fn<() => Promise<{ error?: string; success?: boolean }>>(),
);

vi.mock('@/app/account/actions', () => ({ changePassword }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function render(page: ReactNode): Promise<void> {
  await act(async () =>
    root.render(<ChangePasswordLayout>{page}</ChangePasswordLayout>),
  );
}

// What Next renders under the layout once the action has cleared the
// session: the page's `redirect()`, which throws, and would send the browser
// to sign-in if anything rendered it.
function RedirectingPage(): never {
  throw new Error('redirect:/signin?next=%2Fauth%2Fpassword%2Fchange');
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

describe('change password layout, through a change', () => {
  beforeEach(() => {
    changePassword.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the changed card when the page comes back as a redirect', async () => {
    changePassword.mockResolvedValue({ success: true });
    await render(<ChangePasswordForm />);

    await submit('a new password');

    expect(container.innerText).toContain('Password changed');
    expect(container.innerText).toContain('signed you out everywhere');

    await render(<RedirectingPage />);

    expect(container.innerText).toContain('Password changed');
  });

  it('keeps a refused change on the form and says why', async () => {
    changePassword.mockResolvedValue({ error: 'Password is too short' });
    await render(<ChangePasswordForm />);

    await submit('short');

    expect(container.innerText).toContain('Password is too short');
    expect(container.innerText).not.toContain('Password changed');
    expect(container.querySelector('button')?.disabled).toBe(false);
  });
});
