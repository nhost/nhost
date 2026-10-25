// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountLayout from '@/app/account/layout';
import ChangePasswordSetting from '@/app/auth/password/change/ChangePasswordSetting';

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
  await act(async () => root.render(<AccountLayout>{page}</AccountLayout>));
}

// What Next renders under the layout once the action has cleared the
// session: the account page's `redirect()`, which throws, and would send the
// browser to sign-in if anything rendered it.
function RedirectingPage(): never {
  throw new Error('redirect:/signin?next=%2Faccount');
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

const row = (): HTMLButtonElement | null =>
  container.querySelector('button[aria-haspopup="dialog"]');

const dialog = (): HTMLDialogElement | null =>
  container.querySelector('dialog');

async function submit(password: string): Promise<void> {
  await act(async () => row()?.click());
  await act(async () => {
    for (const input of container.querySelectorAll('input')) {
      type(input, password);
    }
  });
  await act(async () =>
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

describe('change password row, through a change', () => {
  beforeEach(() => {
    changePassword.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('opens the form in a dialog and closes it again', async () => {
    await render(<ChangePasswordSetting />);

    expect(dialog()?.open).toBe(false);
    expect(dialog()?.querySelector('form')).toBeNull();

    await act(async () => row()?.click());

    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent).toContain('signed out everywhere');

    const cancel = [...(dialog()?.querySelectorAll('button') ?? [])].find(
      (candidate) => candidate.textContent === 'Cancel',
    );
    await act(async () => cancel?.click());

    expect(dialog()?.open).toBe(false);
  });

  it('holds the change back until both entries meet the rules', async () => {
    await render(<ChangePasswordSetting />);
    await act(async () => row()?.click());
    const change = (): HTMLButtonElement | null | undefined =>
      dialog()?.querySelector('button[type="submit"]');
    const [password, confirm] = dialog()?.querySelectorAll('input') ?? [];

    expect(change()?.disabled).toBe(true);

    await act(async () => {
      type(password, 'a new password');
      type(confirm, 'a new passwor');
    });
    expect(change()?.disabled).toBe(true);

    await act(async () => type(confirm, 'a new password'));
    expect(change()?.disabled).toBe(false);
  });

  it('keeps the changed card when the page comes back as a redirect', async () => {
    changePassword.mockResolvedValue({ success: true });
    await render(<ChangePasswordSetting />);

    await submit('a new password');

    expect(container.textContent).toContain('Password changed');
    expect(container.textContent).toContain('signed you out everywhere');

    await render(<RedirectingPage />);

    expect(container.textContent).toContain('Password changed');
  });

  it('keeps a refused change on the form and says why', async () => {
    changePassword.mockResolvedValue({ error: 'Password is too short' });
    await render(<ChangePasswordSetting />);

    await submit('short');

    expect(container.textContent).toContain('Password is too short');
    expect(container.textContent).not.toContain('Password changed');
  });
});
