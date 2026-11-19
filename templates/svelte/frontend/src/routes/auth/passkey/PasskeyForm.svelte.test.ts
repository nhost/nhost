import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasskeyForm from './PasskeyForm.svelte';
import { passkeysOnThisDevice } from './thisDevice.ts';

const goto = vi.hoisted(() => vi.fn());
const actions = vi.hoisted(() => ({
  beginSignIn: vi.fn(),
  finishSignIn: vi.fn(),
  beginSignUp: vi.fn(),
  finishSignUp: vi.fn(),
}));
const webauthn = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(),
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/auth/passkey') },
}));
vi.mock('./actions.remote.ts', () => actions);
vi.mock('@simplewebauthn/browser', () => webauthn);

describe('passkey form', () => {
  beforeEach(() => {
    for (const fn of [
      goto,
      ...Object.values(actions),
      ...Object.values(webauthn),
    ]) {
      fn.mockReset();
    }
    webauthn.browserSupportsWebAuthn.mockReturnValue(true);
    localStorage.clear();
  });

  // The browser's step sits between the two server calls: options from the
  // first, credential into the second.
  it('runs the sign-in ceremony and lands on next', async () => {
    const options = { challenge: 'c' };
    const credential = { id: 'cred' };
    actions.beginSignIn.mockResolvedValueOnce({ options });
    webauthn.startAuthentication.mockResolvedValueOnce(credential);
    actions.finishSignIn.mockResolvedValueOnce({ success: true });
    render(PasskeyForm, { props: { next: '/protected', intent: 'sign-in' } });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Sign in with a passkey' }),
    );

    await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/protected'));
    expect(webauthn.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: options,
    });
    expect(actions.finishSignIn).toHaveBeenCalledWith(credential);
    expect(passkeysOnThisDevice().has('cred')).toBe(true);
  });

  it('says so when the prompt is dismissed', async () => {
    actions.beginSignIn.mockResolvedValueOnce({ options: {} });
    webauthn.startAuthentication.mockRejectedValueOnce(
      Object.assign(new Error('dismissed'), { name: 'NotAllowedError' }),
    );
    render(PasskeyForm, { props: { next: '/protected', intent: 'sign-in' } });

    await fireEvent.click(
      screen.getByRole('button', { name: 'Sign in with a passkey' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The passkey prompt was cancelled.',
    );
    expect(goto).not.toHaveBeenCalled();
  });
});
