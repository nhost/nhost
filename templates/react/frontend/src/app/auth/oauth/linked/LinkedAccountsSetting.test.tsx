// @vitest-environment happy-dom
import type { User } from '@nhost/nhost-js/auth';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LinkedAccountsSetting from '@/app/auth/oauth/linked/LinkedAccountsSetting';
import { SettingsList } from '@/components/Setting';

const listLinkedAccounts = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/oauth/linked/actions', () => ({ listLinkedAccounts }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const user = { id: 'user-1', email: 'user@example.com' } as User;

let container: HTMLElement;
let root: Root;

async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <SettingsList>
        <LinkedAccountsSetting user={user} />
      </SettingsList>,
    ),
  );
}

const row = (): string => container.querySelector('li')?.textContent ?? '';

describe('linked accounts setting', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_NHOST_OAUTH_PROVIDERS', 'github,google');
    listLinkedAccounts.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  // Before the list arrives the row offers neither "None" nor "Add", which
  // would be wrong for an account that has links.
  it('says it is loading until the list arrives', async () => {
    listLinkedAccounts.mockReturnValueOnce(new Promise(() => undefined));

    await render();

    expect(row()).toContain('Loading…');
    expect(row()).not.toContain('None');
  });

  it('names the providers the account is linked to', async () => {
    listLinkedAccounts.mockResolvedValueOnce({
      links: [
        { id: 'l1', providerId: 'github', createdAt: '2026-10-01T00:00:00Z' },
      ],
    });

    await render();

    expect(row()).toContain('GitHub');
    expect(row()).not.toContain('Google');
    expect(row()).toContain('Manage');
  });
});
