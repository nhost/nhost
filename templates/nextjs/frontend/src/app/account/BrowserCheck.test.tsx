// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BrowserCheck from '@/app/account/BrowserCheck';

const getUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/client', () => ({ nhost: { auth: { getUser } } }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function render(): Promise<void> {
  await act(async () => root.render(<BrowserCheck />));
}

const text = (role: string): string | null =>
  container.querySelector(`[role="${role}"]`)?.textContent ?? null;

describe('browser check', () => {
  beforeEach(() => {
    getUser.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the email the auth service returned to the browser', async () => {
    getUser.mockResolvedValueOnce({ body: { email: 'ada@example.com' } });

    await render();

    expect(getUser).toHaveBeenCalledOnce();
    expect(text('status')).toBe('The browser is signed in as ada@example.com.');
  });

  it('says so when the call fails', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    getUser.mockRejectedValueOnce(new Error('401'));

    await render();

    expect(text('alert')).toBe('The browser could not read the session.');
  });
});
