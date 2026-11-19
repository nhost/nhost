// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OtpForm from '@/app/auth/otp/OtpForm.vue';
import { buttonIn, click, type Mounted, mountAt, typeIn } from '@/test/mount';

const actions = vi.hoisted(() => ({
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
}));

vi.mock('@/app/auth/otp/actions', () => actions);

let mounted: Mounted;

async function render(sentTo?: string): Promise<void> {
  mounted = await mountAt(OtpForm, '/auth/otp', {
    props: { next: '/account', sentTo },
  });
}

const field = (name: string): HTMLInputElement | null =>
  mounted.el.querySelector(`input[name="${name}"]`);

const type = (name: string, value: string) => typeIn(field(name), value);

const press = (label: string) => click(buttonIn(mounted.el, label));

describe('email code form', () => {
  beforeEach(() => {
    actions.sendCode.mockReset();
    actions.verifyCode.mockReset();
  });

  // Arriving from the code email, sending again would replace the code it
  // holds.
  it('takes a code already sent without sending another', async () => {
    await render();
    await type('email', 'user@example.com');

    await press('I already have a code');

    expect(actions.sendCode).not.toHaveBeenCalled();
    expect(field('otp')).not.toBeNull();
    expect(mounted.el.textContent).toContain(
      'Enter the code from the most recent email we sent to user@example.com.',
    );
  });

  it('checks the address before taking a code already sent', async () => {
    await render();
    await type('email', 'user@');

    await press('I already have a code');

    expect(field('otp')).toBeNull();
    expect(field('email')).not.toBeNull();
  });

  it('says earlier codes stop working once a new one is sent', async () => {
    actions.sendCode.mockResolvedValue({ success: true });
    await render('user@example.com');
    expect(mounted.el.textContent).toContain(
      'We sent a code to user@example.com.',
    );

    await press('Send a new code');

    expect(actions.sendCode).toHaveBeenCalledWith(
      'user@example.com',
      '/account',
    );
    expect(mounted.el.textContent).toContain(
      'We sent a new code to user@example.com. Codes from earlier emails no longer work.',
    );
  });

  it('signs in with the right code after a wrong one', async () => {
    actions.verifyCode
      .mockResolvedValueOnce({ error: 'That code did not work.' })
      .mockResolvedValueOnce({ success: true });
    await render('user@example.com');

    await type('otp', '111111');
    await press('Sign in');
    expect(
      mounted.el.querySelector('[role="alert"]')?.textContent?.trim(),
    ).toBe('That code did not work.');

    await type('otp', '222222');
    await press('Sign in');

    expect(actions.verifyCode).toHaveBeenLastCalledWith(
      'user@example.com',
      '222222',
    );
    expect(mounted.router.currentRoute.value.path).toBe('/account');
  });

  // The input's numeric pattern would block the submit otherwise.
  it('drops the spaces from a pasted code', async () => {
    await render('user@example.com');

    await type('otp', ' 123 456\n');

    expect(field('otp')?.value).toBe('123456');
  });
});
