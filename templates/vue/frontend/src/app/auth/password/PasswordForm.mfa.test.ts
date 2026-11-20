// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordForm from '@/app/auth/password/PasswordForm.vue';
import { inputFor, type Mounted, mountAt, submit, typeIn } from '@/test/mount';

const actions = vi.hoisted(() => ({
  signIn: vi.fn(),
  verifyMfa: vi.fn(),
  signUp: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

vi.mock('@/app/auth/password/actions', () => actions);

let mounted: Mounted;

const path = (): string => mounted.router.currentRoute.value.path;

const type = (label: string, value: string) =>
  typeIn(inputFor(mounted.el, label), value);

const send = () => submit(mounted.el.querySelector('form'));

const hasLabel = (label: string): boolean =>
  [...mounted.el.querySelectorAll('label')].some(
    (candidate) => candidate.textContent?.trim() === label,
  );

describe('password sign-in with two-factor on', () => {
  beforeEach(async () => {
    for (const fn of Object.values(actions)) {
      fn.mockReset();
    }
    mounted = await mountAt(PasswordForm, '/auth/password?intent=sign-in', {
      props: { next: '/account', intent: 'sign-in' },
    });
  });

  it('asks for the code, then trades it for the session', async () => {
    actions.signIn.mockResolvedValueOnce({ mfaTicket: 'mfaTotp:abc' });
    actions.verifyMfa.mockResolvedValueOnce({ success: true });
    await type('Email', 'user@example.com');
    await type('Password', 'password');

    await send();

    expect(hasLabel('Authenticator code')).toBe(true);
    expect(hasLabel('Password')).toBe(false);
    expect(path()).toBe('/auth/password');

    await type('Authenticator code', '123456');
    await send();

    expect(actions.verifyMfa).toHaveBeenCalledWith('mfaTotp:abc', '123456');
    expect(path()).toBe('/account');
  });

  // Auth spends the ticket on the first attempt, even a wrong one, so a retry
  // on the same ticket could never succeed.
  it('signs in again for a fresh ticket after a wrong code', async () => {
    actions.signIn
      .mockResolvedValueOnce({ mfaTicket: 'mfaTotp:first' })
      .mockResolvedValueOnce({ mfaTicket: 'mfaTotp:second' });
    actions.verifyMfa
      .mockResolvedValueOnce({
        error: 'Could not verify the code: Invalid TOTP',
      })
      .mockResolvedValueOnce({ success: true });
    await type('Email', 'user@example.com');
    await type('Password', 'password');
    await send();

    await type('Authenticator code', '000000');
    await send();

    expect(mounted.el.textContent).toContain('Invalid TOTP');
    expect(path()).toBe('/auth/password');

    await type('Authenticator code', '123456');
    await send();

    expect(actions.signIn).toHaveBeenLastCalledWith(
      'user@example.com',
      'password',
    );
    expect(actions.verifyMfa).toHaveBeenLastCalledWith(
      'mfaTotp:second',
      '123456',
    );
    expect(path()).toBe('/account');
  });
});
