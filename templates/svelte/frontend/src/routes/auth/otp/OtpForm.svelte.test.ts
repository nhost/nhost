import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtpForm from './OtpForm.svelte';

const actions = vi.hoisted(() => ({
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
}));
const goto = vi.hoisted(() => vi.fn());

vi.mock('./actions.remote.ts', () => actions);
vi.mock('$app/navigation', () => ({ goto }));

const input = (name: string): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`);

async function type(name: string, value: string): Promise<void> {
  const field = input(name);
  if (!field) {
    throw new Error(`no ${name} input`);
  }
  await fireEvent.input(field, { target: { value } });
}

async function click(label: string): Promise<void> {
  await fireEvent.click(screen.getByRole('button', { name: label }));
}

describe('email code form', () => {
  beforeEach(() => {
    actions.sendCode.mockReset();
    actions.verifyCode.mockReset();
    goto.mockReset();
  });

  // Arriving from the code email, sending again would replace the code it
  // holds.
  it('takes a code already sent without sending another', async () => {
    render(OtpForm, { props: { next: '/account' } });
    await type('email', 'user@example.com');

    await click('I already have a code');

    expect(actions.sendCode).not.toHaveBeenCalled();
    expect(input('otp')).not.toBeNull();
    expect(document.body.textContent).toContain(
      'Enter the code from the most recent email we sent to user@example.com.',
    );
  });

  it('checks the address before taking a code already sent', async () => {
    render(OtpForm, { props: { next: '/account' } });
    await type('email', 'user@');

    await click('I already have a code');

    expect(input('otp')).toBeNull();
    expect(input('email')).not.toBeNull();
  });

  it('says earlier codes stop working once a new one is sent', async () => {
    actions.sendCode.mockResolvedValue({ success: true });
    render(OtpForm, {
      props: { next: '/account', sentTo: 'user@example.com' },
    });
    expect(document.body.textContent).toContain(
      'We sent a code to user@example.com.',
    );

    await click('Send a new code');

    expect(actions.sendCode).toHaveBeenCalledWith({
      email: 'user@example.com',
      next: '/account',
    });
    await vi.waitFor(() =>
      expect(document.body.textContent?.replace(/\s+/g, ' ')).toContain(
        'We sent a new code to user@example.com. Codes from earlier emails no longer work.',
      ),
    );
  });

  it('signs in with the right code after a wrong one', async () => {
    actions.verifyCode
      .mockResolvedValueOnce({ error: 'That code did not work.' })
      .mockResolvedValueOnce({ success: true });
    render(OtpForm, {
      props: { next: '/account', sentTo: 'user@example.com' },
    });

    await type('otp', '111111');
    await click('Sign in');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'That code did not work.',
    );

    await type('otp', '222222');
    await click('Sign in');

    expect(actions.verifyCode).toHaveBeenLastCalledWith({
      email: 'user@example.com',
      otp: '222222',
    });
    await vi.waitFor(() =>
      expect(goto).toHaveBeenCalledWith('/account', { refreshAll: true }),
    );
  });

  // The input's numeric pattern would block the submit otherwise.
  it('drops the spaces from a pasted code', async () => {
    render(OtpForm, {
      props: { next: '/account', sentTo: 'user@example.com' },
    });

    await type('otp', ' 123 456\n');

    expect(input('otp')?.value).toBe('123456');
  });
});
