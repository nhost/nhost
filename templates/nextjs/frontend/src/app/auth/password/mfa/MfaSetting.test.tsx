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

  it('fetches a code to scan on opening, and turns on with the code', async () => {
    actions.generateMfa.mockResolvedValueOnce({
      setup: { imageUrl: 'data:image/png;base64,qr', totpSecret: 'SECRET' },
    });
    actions.enableMfa.mockResolvedValueOnce({ success: true });
    await render(false);

    await act(async () => row()?.click());

    expect(actions.generateMfa).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(true);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/png;base64,qr',
    );
    expect(container.textContent).toContain('SECRET');
    expect(container.textContent).toContain(
      'Only signing in with your password',
    );

    await enterCode('123456');

    expect(actions.enableMfa).toHaveBeenCalledWith('123456');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(isOpen()).toBe(false);
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

  it('says so when the setup cannot start, with no code field', async () => {
    actions.generateMfa.mockResolvedValueOnce({ error: 'Not now' });
    await render(false);

    await act(async () => row()?.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Not now',
    );
    expect(container.querySelector('input')).toBeNull();
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
