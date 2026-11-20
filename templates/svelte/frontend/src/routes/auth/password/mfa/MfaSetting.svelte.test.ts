import type { User } from '@nhost/nhost-js/auth';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Toast from '#lib/components/Toast.svelte';
import InLayout from '#lib/testing/InLayout.svelte';
import MfaSetting from './MfaSetting.svelte';

const actions = vi.hoisted(() => ({
  generateMfa: vi.fn(),
  enableMfa: vi.fn(),
  disableMfa: vi.fn(),
}));
const refreshAll = vi.hoisted(() => vi.fn());

vi.mock('./actions.remote.ts', () => actions);
vi.mock('$app/navigation', () => ({ refreshAll }));

const key = 'LBU4RFZ3L6VWIXZG';

const show = (active: boolean): void => {
  render(InLayout, {
    props: {
      layout: Toast,
      page: MfaSetting,
      props: {
        user: { id: 'user-1', activeMfaType: active ? 'totp' : '' } as User,
      },
    },
  });
};

const row = (): HTMLButtonElement =>
  document.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;

const isOpen = (): boolean => !!document.querySelector('dialog')?.open;

// The toast outside the dialog, on the page.
const toastText = (): string | null =>
  document.querySelector('[popover] p')?.textContent?.trim() ?? null;

describe('two-factor row', () => {
  beforeEach(() => {
    for (const action of Object.values(actions)) {
      action.mockReset();
    }
    refreshAll.mockReset();
    actions.generateMfa.mockResolvedValue({
      setup: { imageUrl: 'data:image/png;base64,qr', totpSecret: key },
    });
  });

  // Inside the form, so it must not submit it.
  it('copies the key to enter by hand, without the spaces it is shown with', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    show(false);
    await fireEvent.click(row());

    await fireEvent.click(
      await screen.findByRole('button', { name: 'Copy key' }),
    );

    expect(writeText).toHaveBeenCalledWith(key);
    expect(actions.enableMfa).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(toastText()).toBe('Key copied'));
    // The open modal makes the toast inert, so it is announced from inside.
    expect(
      document
        .querySelector('dialog[open] [role="status"]')
        ?.textContent?.trim(),
    ).toBe('Key copied');

    // The toast is about a key that is no longer on screen.
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(isOpen()).toBe(false);
    expect(toastText()).toBeNull();
  });

  it('fetches a code to scan on opening, and turns on with the code', async () => {
    actions.enableMfa.mockResolvedValueOnce({ success: true });
    show(false);

    await fireEvent.click(row());

    expect(actions.generateMfa).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(true);
    expect(
      (
        await screen.findByAltText('QR code for the authenticator app')
      ).getAttribute('src'),
    ).toBe('data:image/png;base64,qr');
    // Shown in groups of four, as authenticator apps show it.
    expect(document.querySelector('code')?.textContent).toBe(
      'LBU4 RFZ3 L6VW IXZG',
    );
    expect(document.body.textContent).toContain(
      'when you sign in with your password. Other sign-in methods and emailed links skip it.',
    );
    expect(document.body.textContent).toContain(
      '1. Scan this QR code with your authenticator app.',
    );

    await fireEvent.input(screen.getByLabelText('2. Enter the 6-digit code.'), {
      target: { value: '123456' },
    });
    await fireEvent.submit(
      document.querySelector('dialog form') as HTMLFormElement,
    );

    expect(actions.enableMfa).toHaveBeenCalledWith('123456');
    await vi.waitFor(() => expect(refreshAll).toHaveBeenCalledTimes(1));
    expect(isOpen()).toBe(false);

    // Before the page has loaded again, so opening it again offers the way
    // back rather than another setup.
    expect(document.querySelector('li')?.textContent).toContain('On');
    expect(row().textContent?.trim()).toBe('Turn off');
  });
});
