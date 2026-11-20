import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { passkeysOnThisDevice, rememberPasskey } from '../thisDevice.ts';
import type { Passkey } from './actions.remote.ts';
import ManagePasskeys from './ManagePasskeys.svelte';

const refreshAll = vi.hoisted(() => vi.fn());
const actions = vi.hoisted(() => ({
  beginAddPasskey: vi.fn(),
  finishAddPasskey: vi.fn(),
  removePasskey: vi.fn(),
}));
const webauthn = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(),
  startRegistration: vi.fn(),
}));

vi.mock('$app/navigation', () => ({ refreshAll }));
vi.mock('./actions.remote.ts', () => actions);
vi.mock('@simplewebauthn/browser', () => webauthn);

const chromeOnMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

const keys: Passkey[] = [{ id: 'k1', credentialId: 'c1', nickname: 'Phone' }];

const nameField = (): HTMLInputElement =>
  screen.getByLabelText('Name for a new passkey') as HTMLInputElement;

describe('managing passkeys', () => {
  beforeEach(() => {
    for (const fn of [
      refreshAll,
      ...Object.values(actions),
      ...Object.values(webauthn),
    ]) {
      fn.mockReset();
    }
    webauthn.browserSupportsWebAuthn.mockReturnValue(true);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(chromeOnMac);
    localStorage.clear();
  });

  it('starts the name as the device it is added on', () => {
    render(ManagePasskeys, { props: { keys } });

    expect(nameField().value).toBe('Chrome - macOS');
  });

  // Added or used here before, so the device would refuse another.
  it('marks the passkey this browser holds and says so before adding', () => {
    rememberPasskey('c1');
    render(ManagePasskeys, { props: { keys } });

    expect(document.querySelector('li')?.textContent).toContain('This device');
    expect(document.body.textContent).toContain(
      'This browser already has a passkey for your account. To add another, use your phone or a security key.',
    );
    expect(nameField().value).toBe('');
  });

  // Options from the first server call, credential into the second, with the
  // browser's step between them.
  it('runs the add ceremony and loads the list again', async () => {
    const options = { challenge: 'c' };
    const credential = { id: 'new' };
    actions.beginAddPasskey.mockResolvedValueOnce({ options });
    webauthn.startRegistration.mockResolvedValueOnce(credential);
    actions.finishAddPasskey.mockResolvedValueOnce({ success: true });
    render(ManagePasskeys, { props: { keys } });

    await fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await vi.waitFor(() => expect(refreshAll).toHaveBeenCalled());
    expect(webauthn.startRegistration).toHaveBeenCalledWith({
      optionsJSON: options,
    });
    expect(actions.finishAddPasskey).toHaveBeenCalledWith({
      credential,
      nickname: 'Chrome - macOS',
    });
    expect(passkeysOnThisDevice().has('new')).toBe(true);
  });

  // Before the server answers, so it cannot be pressed again while the page
  // loads again.
  it('takes the passkey off the list as soon as Remove is pressed', async () => {
    actions.removePasskey.mockReturnValueOnce(new Promise(() => undefined));
    render(ManagePasskeys, { props: { keys } });

    await fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(document.querySelector('li')).toBeNull();
  });
});
