// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasskeyForm from '@/app/auth/passkey/PasskeyForm';
import { passkeysOnThisDevice } from '@/app/auth/passkey/thisDevice';

const actions = vi.hoisted(() => ({
  beginSignIn: vi.fn(),
  finishSignIn: vi.fn(),
  beginSignUp: vi.fn(),
  finishSignUp: vi.fn(),
}));

const webauthn = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

vi.mock('@/app/auth/passkey/actions', () => actions);
vi.mock('@simplewebauthn/browser', () => webauthn);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let url = '';

function Where() {
  const location = useLocation();
  url = `${location.pathname}${location.search}`;
  return null;
}

async function render(intent: 'sign-in' | 'sign-up'): Promise<void> {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/auth/passkey?next=%2Fprotected']}>
        <PasskeyForm next="/protected" intent={intent} />
        <Where />
      </MemoryRouter>,
    ),
  );
}

async function click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

describe('passkey form', () => {
  beforeEach(() => {
    for (const fn of [
      ...Object.values(actions),
      webauthn.startAuthentication,
      webauthn.startRegistration,
    ]) {
      fn.mockReset();
    }
    webauthn.browserSupportsWebAuthn.mockReturnValue(true);
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The ceremony is three steps in order, and the browser's step sits between
  // the two server calls: options from the first, credential into the second.
  it('runs the sign-in ceremony and lands on next', async () => {
    const options = { challenge: 'c' };
    const credential = { id: 'cred' };
    actions.beginSignIn.mockResolvedValueOnce({ options });
    webauthn.startAuthentication.mockResolvedValueOnce(credential);
    actions.finishSignIn.mockResolvedValueOnce({ success: true });
    await render('sign-in');

    await click('Sign in with a passkey');

    expect(webauthn.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: options,
    });
    expect(actions.finishSignIn).toHaveBeenCalledWith(credential);
    expect(passkeysOnThisDevice().has('cred')).toBe(true);
    expect(url).toBe('/protected');
  });
});
