// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasskeyForm from '@/app/auth/passkey/PasskeyForm';
import Passkey from '@/app/auth/passkey/page';
import { passkeysOnThisDevice } from '@/app/auth/passkey/thisDevice';

const router = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

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

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/auth/passkey',
}));

vi.mock('@/app/auth/passkey/actions', () => actions);
vi.mock('@simplewebauthn/browser', () => webauthn);

// Two entries, so "Other ways to sign in" renders. Neither names a method.
vi.mock('@/app/signin/methods', () => ({
  methods: [{}, {}],
  buttons: [],
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function render(intent: 'sign-in' | 'sign-up'): Promise<void> {
  await act(async () =>
    root.render(
      <PasskeyForm next="/protected" intent={intent} mailboxURL={null} />,
    ),
  );
}

async function click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

const alertText = (): string | null =>
  container.querySelector('[role="alert"]')?.textContent ?? null;

describe('passkey form', () => {
  beforeEach(() => {
    for (const fn of [
      ...Object.values(router),
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

  // "Other ways to sign in" is rendered on the server from the URL, so a mode
  // the visitor switched to only reaches it through the URL.
  it('writes the mode it switched to into the URL, keeping next', async () => {
    await render('sign-up');

    await click('I already have an account');

    expect(router.replace).toHaveBeenLastCalledWith(
      '/auth/passkey?next=%2Fprotected&intent=sign-in',
      { scroll: false },
    );
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
    expect(router.push).toHaveBeenCalledWith('/protected');
  });

  it('says so when the prompt was cancelled, and does not verify', async () => {
    actions.beginSignIn.mockResolvedValueOnce({ options: {} });
    webauthn.startAuthentication.mockRejectedValueOnce(
      Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }),
    );
    await render('sign-in');

    await click('Sign in with a passkey');

    expect(alertText()).toBe('The passkey prompt was cancelled.');
    expect(actions.finishSignIn).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('stops before the backend when the browser cannot do passkeys', async () => {
    webauthn.browserSupportsWebAuthn.mockReturnValue(false);
    await render('sign-in');

    await click('Sign in with a passkey');

    expect(alertText()).toBe('This browser does not support passkeys.');
    expect(actions.beginSignIn).not.toHaveBeenCalled();
  });

  it('points the back link at the mode the URL names', async () => {
    const html = renderToStaticMarkup(
      await Passkey({ searchParams: Promise.resolve({ intent: 'sign-in' }) }),
    );

    expect(html).toContain('href="/signin?intent=sign-in"');
  });
});
