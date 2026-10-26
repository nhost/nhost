// @vitest-environment happy-dom
import type { User } from '@nhost/nhost-js/auth';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MfaSetting from '@/app/auth/password/mfa/MfaSetting';
import { SettingsList } from '@/components/Setting';

const actions = vi.hoisted(() => ({
  generateMfa: vi.fn(),
  enableMfa: vi.fn(),
  disableMfa: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/password/mfa/actions', () => actions);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const user = { id: 'u1', activeMfaType: null } as unknown as User;

const key = 'LBU4RFZ3L6VWIXZG';

let container: HTMLElement;
let root: Root;

async function render(active: boolean): Promise<void> {
  await act(async () =>
    root.render(
      <SettingsList>
        <MfaSetting
          user={{ ...user, activeMfaType: active ? 'totp' : undefined }}
        />
      </SettingsList>,
    ),
  );
}

const row = (): HTMLButtonElement | null =>
  container.querySelector('button[aria-haspopup="dialog"]');

const isOpen = (): boolean => container.querySelector('dialog')?.open ?? false;

async function enterCode(code: string): Promise<void> {
  const input = container.querySelector('input') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () =>
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

describe('two-factor row', () => {
  beforeEach(() => {
    for (const action of Object.values(actions)) {
      action.mockReset();
    }
    refresh.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('says where the account stands without opening', async () => {
    await render(false);
    expect(container.querySelector('li')?.textContent).toContain('Off');
    expect(row()?.textContent).toBe('Set up');
    expect(isOpen()).toBe(false);

    await render(true);
    expect(container.querySelector('li')?.textContent).toContain('On');
    expect(row()?.textContent).toBe('Turn off');
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
    await act(async () => row()?.click());

    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Copy key"]')
        ?.click(),
    );

    expect(writeText).toHaveBeenCalledWith(key);
    expect(actions.enableMfa).not.toHaveBeenCalled();
  });

  it('fetches a code to scan on opening, and turns on with the code', async () => {
    actions.generateMfa.mockResolvedValueOnce({
      setup: { imageUrl: 'data:image/png;base64,qr', totpSecret: key },
    });
    actions.enableMfa.mockResolvedValueOnce({ success: true });
    await render(false);

    await act(async () => row()?.click());

    expect(actions.generateMfa).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(true);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/png;base64,qr',
    );
    // Shown in groups of four, as authenticator apps show it.
    expect(container.querySelector('code')?.textContent).toBe(
      'LBU4 RFZ3 L6VW IXZG',
    );
    expect(container.textContent).toContain(
      'when you sign in with your password. Other sign-in methods and emailed links skip it.',
    );
    expect(container.textContent).toContain(
      '1. Scan this QR code with your authenticator app.',
    );
    expect(container.querySelector('label')?.textContent).toBe(
      '2. Enter the 6-digit code.',
    );

    await enterCode('123456');

    expect(actions.enableMfa).toHaveBeenCalledWith('123456');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);

    // Before the refreshed page arrives, so opening it again offers the way
    // back rather than another setup.
    expect(container.querySelector('li')?.textContent).toContain('On');
    expect(row()?.textContent).toBe('Turn off');
  });

  it('asks for a current code to turn it off, without a new secret', async () => {
    actions.disableMfa.mockResolvedValueOnce({ success: true });
    await render(true);

    await act(async () => row()?.click());

    expect(actions.generateMfa).not.toHaveBeenCalled();
    expect(container.querySelector('img')).toBeNull();

    await enterCode('654321');

    expect(actions.disableMfa).toHaveBeenCalledWith('654321');
    expect(actions.enableMfa).not.toHaveBeenCalled();
  });

  it('stays open and says why when the code is refused', async () => {
    actions.disableMfa.mockResolvedValueOnce({ error: 'Invalid code' });
    await render(true);

    await act(async () => row()?.click());
    await enterCode('000000');

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Invalid code',
    );
    expect(isOpen()).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });

  // The field is laid out from the start, so the dialog keeps its size, but
  // there is no key to prove.
  it('says so when the setup cannot start, with the code field off', async () => {
    actions.generateMfa.mockResolvedValueOnce({ error: 'Not now' });
    await render(false);

    await act(async () => row()?.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Not now',
    );
    expect(container.querySelector('input')?.disabled).toBe(true);
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.disabled,
    ).toBe(true);
  });

  it('holds the room for the QR code while the key is on its way', async () => {
    actions.generateMfa.mockReturnValueOnce(new Promise(() => undefined));
    await render(false);

    await act(async () => row()?.click());

    expect(container.textContent).toContain('Preparing a code to scan…');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('input')?.disabled).toBe(true);
  });

  it('closes from Cancel without changing anything', async () => {
    await render(true);

    await act(async () => row()?.click());
    expect(isOpen()).toBe(true);

    const cancel = [...container.querySelectorAll('dialog button')].find(
      (candidate) => candidate.textContent === 'Cancel',
    ) as HTMLButtonElement | undefined;
    await act(async () => cancel?.click());

    expect(isOpen()).toBe(false);
    expect(actions.disableMfa).not.toHaveBeenCalled();
  });
});
