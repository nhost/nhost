import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordForm from './PasswordForm.svelte';

const goto = vi.hoisted(() => vi.fn());
const actions = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  verifyMfa: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/auth/password') },
}));
vi.mock('./actions.remote.ts', () => actions);

async function type(label: string, value: string): Promise<void> {
  await fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

async function submit(): Promise<void> {
  await fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

beforeEach(() => {
  for (const fn of [goto, ...Object.values(actions)]) {
    fn.mockReset();
  }
});

describe('password form, switching modes', () => {
  it('writes the mode it switched to into the URL, keeping next', async () => {
    render(PasswordForm, { props: { next: '/protected', intent: 'sign-up' } });

    await fireEvent.click(
      screen.getByRole('button', { name: 'I already have an account' }),
    );

    expect(goto).toHaveBeenLastCalledWith(
      '/auth/password?next=%2Fprotected&intent=sign-in',
      { replace: true, reset: false },
    );

    await fireEvent.click(
      screen.getByRole('button', { name: 'Create an account' }),
    );

    expect(goto).toHaveBeenLastCalledWith('/auth/password?next=%2Fprotected', {
      replace: true,
      reset: false,
    });
  });
});

describe('password sign-in with two-factor on', () => {
  beforeEach(() => {
    render(PasswordForm, { props: { next: '/account', intent: 'sign-in' } });
  });

  it('asks for the code, then trades it for the session', async () => {
    actions.signIn.mockResolvedValueOnce({ mfaTicket: 'mfaTotp:abc' });
    actions.verifyMfa.mockResolvedValueOnce({ success: true });
    await type('Email', 'user@example.com');
    await type('Password', 'password');

    await submit();

    expect(await screen.findByLabelText('Authenticator code')).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(goto).not.toHaveBeenCalled();

    await type('Authenticator code', '123456');
    await submit();

    expect(actions.verifyMfa).toHaveBeenCalledWith({
      ticket: 'mfaTotp:abc',
      otp: '123456',
    });
    await vi.waitFor(() =>
      expect(goto).toHaveBeenCalledWith('/account', { refreshAll: true }),
    );
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
    await submit();

    await type('Authenticator code', '000000');
    await submit();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Invalid TOTP',
    );
    expect(goto).not.toHaveBeenCalled();

    await type('Authenticator code', '123456');
    await submit();

    expect(actions.signIn).toHaveBeenLastCalledWith({
      email: 'user@example.com',
      password: 'password',
    });
    expect(actions.verifyMfa).toHaveBeenLastCalledWith({
      ticket: 'mfaTotp:second',
      otp: '123456',
    });
    await vi.waitFor(() =>
      expect(goto).toHaveBeenCalledWith('/account', { refreshAll: true }),
    );
  });
});
