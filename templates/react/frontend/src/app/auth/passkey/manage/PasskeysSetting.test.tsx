// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasskeysSetting from '@/app/auth/passkey/manage/PasskeysSetting';
import { SettingsList } from '@/components/Setting';

const listPasskeys = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/passkey/manage/actions', () => ({ listPasskeys }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <SettingsList>
        <PasskeysSetting />
      </SettingsList>,
    ),
  );
}

const row = (): string => container.querySelector('li')?.textContent ?? '';

describe('passkeys setting', () => {
  beforeEach(() => {
    listPasskeys.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // Before the list arrives the row offers neither "None" nor "Add", which
  // would be wrong for an account that has passkeys.
  it('says it is loading until the list arrives', async () => {
    listPasskeys.mockReturnValueOnce(new Promise(() => undefined));

    await render();

    expect(row()).toContain('Loading…');
    expect(row()).not.toContain('None');
  });

  it('shows the names of the passkeys it loaded', async () => {
    listPasskeys.mockResolvedValueOnce({
      keys: [
        { id: 'k1', credentialId: 'c1', nickname: 'laptop' },
        { id: 'k2', credentialId: 'c2', nickname: null },
      ],
    });

    await render();

    expect(row()).toContain('laptop, Passkey 2');
    expect(row()).toContain('Manage');
  });

  it('offers to add one when there are none', async () => {
    listPasskeys.mockResolvedValueOnce({ keys: [] });

    await render();

    expect(row()).toContain('None');
    expect(row()).toContain('Add');
  });
});
