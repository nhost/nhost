// @vitest-environment happy-dom
import type { User } from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import MfaSetting from '@/app/auth/password/mfa/MfaSetting.vue';
import SettingsList from '@/components/SettingsList.vue';
import ToastProvider from '@/components/ToastProvider.vue';
import {
  buttonIn,
  click,
  type Mounted,
  mountAt,
  submit,
  typeIn,
} from '@/test/mount';

const actions = vi.hoisted(() => ({
  generateMfa: vi.fn(),
  enableMfa: vi.fn(),
  disableMfa: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/password/mfa/actions', () => actions);
vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));

const user = { id: 'u1', activeMfaType: null } as unknown as User;

const key = 'LBU4RFZ3L6VWIXZG';

let mounted: Mounted;

async function render(active: boolean): Promise<void> {
  const account = { ...user, activeMfaType: active ? 'totp' : undefined };
  mounted = await mountAt(() =>
    h(ToastProvider, () =>
      h(SettingsList, () => h(MfaSetting, { user: account })),
    ),
  );
}

const row = (): HTMLButtonElement | null =>
  mounted.el.querySelector('button[aria-haspopup="dialog"]');

const toastText = (): string | null =>
  mounted.el.querySelector('[popover][role="status"]')?.textContent?.trim() ||
  null;

const isOpen = (): boolean => mounted.el.querySelector('dialog')?.open ?? false;

async function enterCode(code: string): Promise<void> {
  await typeIn(mounted.el.querySelector('input'), code);
  await submit(mounted.el.querySelector('form'));
}

describe('two-factor row', () => {
  beforeEach(() => {
    for (const action of Object.values(actions)) {
      action.mockReset();
    }
    refresh.mockReset();
  });

  // Inside the form, so it must not submit it.
  it('copies the key to enter by hand, without the spaces it is shown with', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    actions.generateMfa.mockResolvedValueOnce({
      setup: { imageUrl: 'data:image/png;base64,qr', totpSecret: key },
    });
    await render(false);
    await click(row());

    await click(buttonIn(mounted.el, 'Copy key'));

    expect(writeText).toHaveBeenCalledWith(key);
    expect(actions.enableMfa).not.toHaveBeenCalled();
    expect(toastText()).toBe('Key copied');
    // The open modal makes the toast inert, so it is announced from inside.
    expect(
      mounted.el
        .querySelector('dialog[open] [role="status"]')
        ?.textContent?.trim(),
    ).toBe('Key copied');

    // The toast is about a key that is no longer on screen.
    await click(buttonIn(mounted.el, 'Cancel'));

    expect(isOpen()).toBe(false);
    expect(toastText()).toBeNull();
  });

  it('fetches a code to scan on opening, and turns on with the code', async () => {
    actions.generateMfa.mockResolvedValueOnce({
      setup: { imageUrl: 'data:image/png;base64,qr', totpSecret: key },
    });
    actions.enableMfa.mockResolvedValueOnce({ success: true });
    await render(false);

    await click(row());

    expect(actions.generateMfa).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(true);
    expect(mounted.el.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/png;base64,qr',
    );
    // Shown in groups of four, as authenticator apps show it.
    expect(mounted.el.querySelector('code')?.textContent).toBe(
      'LBU4 RFZ3 L6VW IXZG',
    );
    expect(mounted.el.textContent).toContain(
      'when you sign in with your password. Other sign-in methods and emailed links skip it.',
    );
    expect(mounted.el.textContent).toContain(
      '1. Scan this QR code with your authenticator app.',
    );
    expect(mounted.el.querySelector('label')?.textContent?.trim()).toBe(
      '2. Enter the 6-digit code.',
    );

    await enterCode('123456');

    expect(actions.enableMfa).toHaveBeenCalledWith('123456');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);

    // Before the refreshed page arrives, so opening it again offers the way
    // back rather than another setup.
    expect(mounted.el.querySelector('li')?.textContent).toContain('On');
    expect(row()?.textContent?.trim()).toBe('Turn off');
  });
});
