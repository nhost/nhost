// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayNameForm from '@/app/account/DisplayNameForm';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const updateDisplayName = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/account/actions', () => ({ updateDisplayName }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

// React listens for `input` and reads the value through the native setter,
// so a plain assignment to `.value` would be invisible to it.
async function type(label: string, value: string): Promise<void> {
  const input = [...container.querySelectorAll('label')].find(
    (candidate) => candidate.textContent === label,
  )?.control as HTMLInputElement | undefined;
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    set?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(): Promise<void> {
  await act(async () =>
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

const text = (role: string): string | null =>
  container.querySelector(`[role="${role}"]`)?.textContent ?? null;

describe('display name form', () => {
  beforeEach(async () => {
    router.refresh.mockReset();
    updateDisplayName.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<DisplayNameForm displayName="Ada" />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('opens on the current name', () => {
    expect(container.querySelector('input')?.value).toBe('Ada');
  });

  it('saves the new name and re-reads the page', async () => {
    updateDisplayName.mockResolvedValueOnce({ success: true });
    await type('Display name', 'Ada Lovelace');

    await submit();

    expect(updateDisplayName).toHaveBeenCalledWith('Ada Lovelace');
    expect(text('status')).toBe('Saved.');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('shows the action error and does not re-read', async () => {
    updateDisplayName.mockResolvedValueOnce({ error: 'not applied' });

    await submit();

    expect(text('alert')).toBe('not applied');
    expect(text('status')).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
