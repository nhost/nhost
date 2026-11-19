// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasskeyForm from '@/app/auth/passkey/PasskeyForm.vue';
import { passkeysOnThisDevice } from '@/app/auth/passkey/thisDevice';
import { buttonIn, click, mountAt } from '@/test/mount';

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
  });

  // The ceremony is three steps in order, and the browser's step sits between
  // the two server calls: options from the first, credential into the second.
  it('runs the sign-in ceremony and lands on next', async () => {
    const options = { challenge: 'c' };
    const credential = { id: 'cred' };
    actions.beginSignIn.mockResolvedValueOnce({ options });
    webauthn.startAuthentication.mockResolvedValueOnce(credential);
    actions.finishSignIn.mockResolvedValueOnce({ success: true });
    const { el, router } = await mountAt(
      PasskeyForm,
      '/auth/passkey?next=%2Fprotected',
      { props: { next: '/protected', intent: 'sign-in' } },
    );

    await click(buttonIn(el, 'Sign in with a passkey'));

    expect(webauthn.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: options,
    });
    expect(actions.finishSignIn).toHaveBeenCalledWith(credential);
    expect(passkeysOnThisDevice().has('cred')).toBe(true);
    expect(router.currentRoute.value.fullPath).toBe('/protected');
  });
});
