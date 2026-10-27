// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayNameField from '@/app/account/DisplayNameField';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const updateDisplayName = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/account/actions', () => ({ updateDisplayName }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

// By its words, or by its name for one that is only an icon.
const button = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (candidate) =>
      candidate.textContent === label ||
      candidate.getAttribute('aria-label') === label,
  );

async function click(label: string): Promise<void> {
  await act(async () => button(label)?.click());
}

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

const _text = (role: string): string | null =>
  container.querySelector(`[role="${role}"]`)?.textContent ?? null;

describe('display name field', () => {
  beforeEach(async () => {
    router.refresh.mockReset();
    updateDisplayName.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<DisplayNameField displayName="Ada" />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('saves the new name, closes and re-reads the page', async () => {
    updateDisplayName.mockResolvedValueOnce({ success: true });
    await click('Edit name');
    await type('Display name', 'Ada Lovelace');

    await submit();

    expect(updateDisplayName).toHaveBeenCalledWith('Ada Lovelace');
    expect(container.querySelector('form')).toBeNull();
    expect(router.refresh).toHaveBeenCalled();
  });
});
