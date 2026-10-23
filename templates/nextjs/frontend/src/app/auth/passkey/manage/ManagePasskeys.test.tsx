// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ManagePasskeys from '@/app/auth/passkey/manage/ManagePasskeys';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));

const actions = vi.hoisted(() => ({
  beginAddPasskey: vi.fn(),
  finishAddPasskey: vi.fn(),
  removePasskey: vi.fn(),
}));

const webauthn = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  startRegistration: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/auth/passkey/manage/actions', () => actions);
vi.mock('@simplewebauthn/browser', () => webauthn);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const keys = [{ id: 'k1', credentialId: 'c1', nickname: 'laptop' }];

async function click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

async function submit(): Promise<void> {
  await act(async () =>
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

const alertText = (): string | null =>
  container.querySelector('[role="alert"]')?.textContent ?? null;

describe('manage passkeys', () => {
  beforeEach(async () => {
    for (const fn of [
      router.refresh,
      ...Object.values(actions),
      webauthn.startRegistration,
    ]) {
      fn.mockReset();
    }
    webauthn.browserSupportsWebAuthn.mockReturnValue(true);
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<ManagePasskeys keys={keys} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // Options from the first server call, credential into the second, with the
  // browser's step between them.
  it('runs the add ceremony and refreshes the list', async () => {
    const options = { challenge: 'c' };
    const credential = { id: 'new' };
    actions.beginAddPasskey.mockResolvedValueOnce({ options });
    webauthn.startRegistration.mockResolvedValueOnce(credential);
    actions.finishAddPasskey.mockResolvedValueOnce({ success: true });

    await submit();

    expect(webauthn.startRegistration).toHaveBeenCalledWith({
      optionsJSON: options,
    });
    expect(actions.finishAddPasskey).toHaveBeenCalledWith(credential, '');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('says so when the prompt was cancelled, and does not verify', async () => {
    actions.beginAddPasskey.mockResolvedValueOnce({ options: {} });
    webauthn.startRegistration.mockRejectedValueOnce(
      Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }),
    );

    await submit();

    expect(alertText()).toBe('The passkey prompt was cancelled.');
    expect(actions.finishAddPasskey).not.toHaveBeenCalled();
  });

  it('removes a key and refreshes the list', async () => {
    actions.removePasskey.mockResolvedValueOnce({ success: true });

    await click('Remove');

    expect(actions.removePasskey).toHaveBeenCalledWith('k1');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('shows the error when removing fails', async () => {
    actions.removePasskey.mockResolvedValueOnce({ error: 'not yours' });

    await click('Remove');

    expect(alertText()).toBe('not yours');
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
