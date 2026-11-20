// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChangePasswordForm from '@/app/auth/password/change/ChangePasswordForm';
import ReplacePageLayout from '@/components/ReplacePageLayout';

const changePassword = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/password/change/actions', () => ({ changePassword }));
vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));
vi.mock('@/lib/nhost/client', () => ({
  nhost: { sessionStorage: { remove } },
}));

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

async function render(needsCode = false): Promise<void> {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/account']}>
        <ReplacePageLayout>
          <ChangePasswordForm needsCode={needsCode} />
        </ReplacePageLayout>
        <Where />
      </MemoryRouter>,
    ),
  );
}

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

describe('change password form', () => {
  beforeEach(async () => {
    changePassword.mockReset();
    refresh.mockReset();
    remove.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await render();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The action signed this browser back in with the new password, so only
  // the other devices lost their session and the page stays.
  it('keeps the page when this device is signed back in', async () => {
    changePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await submit();

    expect(changePassword).toHaveBeenCalledWith('correct horse', undefined);
    expect(refresh).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Sign in again');
  });

  // The change revoked this session, so the stored copy goes, but only once
  // the card is up: the account page under it must not react to the sign-out.
  it('shows the changed card in place, then clears the session, when signing back in fails', async () => {
    let shownWhenCleared = false;
    remove.mockImplementation(() => {
      shownWhenCleared = (container.textContent ?? '').includes(
        'Password changed',
      );
    });
    changePassword.mockResolvedValueOnce({ success: true, signedIn: false });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await submit();

    expect(container.textContent).toContain('Password changed');
    expect(remove).toHaveBeenCalled();
    expect(shownWhenCleared).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    expect(path).toBe('/account');
  });

  // Auth refuses over 50 characters, or over 72 bytes for bcrypt.
  it('will not send a password auth would refuse', async () => {
    const change = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );

    for (const password of ['a'.repeat(51), 'é'.repeat(37)]) {
      await type('New password', password);
      await type('Confirm new password', password);
      expect(change?.disabled).toBe(true);
    }
  });

  // Two-factor: signing back in takes a current code as well.
  it('asks a two-factor account for a code and sends it along', async () => {
    act(() => root.unmount());
    root = createRoot(container);
    await render(true);
    changePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    const change = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(change?.disabled).toBe(true);

    await type('Authenticator code', '123456');
    expect(change?.disabled).toBe(false);

    await submit();

    expect(changePassword).toHaveBeenCalledWith('correct horse', '123456');
    expect(refresh).toHaveBeenCalledOnce();
  });
});
