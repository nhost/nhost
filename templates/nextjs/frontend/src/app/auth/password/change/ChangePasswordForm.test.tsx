// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChangePasswordForm from '@/app/auth/password/change/ChangePasswordForm';
import ReplacePageLayout from '@/components/ReplacePageLayout';

const changePassword = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('@/app/account/actions', () => ({ changePassword }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

// React listens for `input` and reads the value through the native setter,
// so a plain assignment to `.value` would be invisible to it.
async function type(label: string, value: string): Promise<void> {
  const input = [...container.querySelectorAll('label')].find(
    (candidate) => candidate.textContent === label,
  )?.control as HTMLInputElement | undefined;
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    set?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(): Promise<void> {
  await act(async () =>
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

const text = (role: string): string | null =>
  container.querySelector(`[role="${role}"]`)?.textContent ?? null;

describe('change password form', () => {
  beforeEach(async () => {
    changePassword.mockReset();
    router.refresh.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <ReplacePageLayout>
          <ChangePasswordForm />
        </ReplacePageLayout>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('refuses mismatched passwords before calling the action', async () => {
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horsf');

    await submit();

    expect(text('alert')).toBe('The two passwords do not match.');
    expect(changePassword).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Password changed');
  });

  // The action signed this browser back in with the new password, so only
  // the other devices lost their session and the page stays.
  it('keeps the page when this device is signed back in', async () => {
    changePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await submit();

    expect(changePassword).toHaveBeenCalledWith('correct horse');
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('Sign in again');
  });

  it('puts the changed card in place of the page when this device is signed out too', async () => {
    changePassword.mockResolvedValueOnce({ success: true, signedIn: false });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await submit();

    expect(container.textContent).toContain('Password changed');
    expect(container.querySelector('form')).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('shows the action error', async () => {
    changePassword.mockResolvedValueOnce({ error: 'too short' });
    await type('New password', 'abc');
    await type('Confirm new password', 'abc');

    await submit();

    expect(text('alert')).toBe('too short');
    expect(container.textContent).not.toContain('Password changed');
  });
});
