// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Passkey } from '@/app/auth/passkey/manage/actions';
import ManagePasskeys from '@/app/auth/passkey/manage/ManagePasskeys';
import {
  passkeysOnThisDevice,
  rememberPasskey,
} from '@/app/auth/passkey/thisDevice';

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

const chromeOnMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const nameField = (): HTMLInputElement | null =>
  container.querySelector('input[type="text"]');

// The dialog's state is set when it opens, so this opens it afresh.
async function reopen(list: Passkey[]): Promise<void> {
  act(() => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<ManagePasskeys keys={list} />));
}

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

const _alertText = (): string | null =>
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
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(chromeOnMac);
    localStorage.clear();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<ManagePasskeys keys={keys} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('starts the name as the device it is added on', () => {
    expect(nameField()?.value).toBe('Chrome - macOS');
  });

  // Added or used here before, so the device would refuse another.
  it('marks the passkey this browser holds and says so before adding', async () => {
    rememberPasskey('c1');
    await reopen(keys);

    const row = container.querySelector('li');
    expect(row?.textContent).toContain('This device');
    expect(container.textContent).toContain(
      'This browser already has a passkey for your account. To add another, use your phone or a security key.',
    );
    expect(nameField()?.value).toBe('');
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
    expect(actions.finishAddPasskey).toHaveBeenCalledWith(
      credential,
      'Chrome - macOS',
    );
    expect(router.refresh).toHaveBeenCalled();
    expect(passkeysOnThisDevice().has('new')).toBe(true);
  });

  // Before the server answers, so it cannot be pressed again while the page
  // is read again.
  it('takes the passkey off the list as soon as Remove is pressed', async () => {
    actions.removePasskey.mockReturnValueOnce(new Promise(() => undefined));

    await click('Remove');

    expect(container.querySelector('li')).toBeNull();
  });
});
