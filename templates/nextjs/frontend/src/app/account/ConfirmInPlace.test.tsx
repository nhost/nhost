// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmInPlace from '@/app/account/ConfirmInPlace';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
const onConfirm = vi.fn<() => Promise<string | undefined>>();

const button = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );

const shown = (label: string): boolean =>
  Boolean(button(label)) && !button(label)?.closest('[inert]');

describe('confirm in place', () => {
  beforeEach(async () => {
    onConfirm.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <ConfirmInPlace
          title="Sessions"
          description="What it does."
          warning="Are you sure?"
          start="Start"
          confirm="Do it"
          pending="Doing…"
          onConfirm={onConfirm}
        />,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('lays out both states from the start, showing only the first', () => {
    expect(shown('Start')).toBe(true);
    expect(shown('Do it')).toBe(false);
    expect(shown('Cancel')).toBe(false);
  });

  // A double click meant as one press lands its second click where the
  // first one was, which has to be Cancel.
  it('puts Cancel in the place of the button that asked', async () => {
    await act(async () => button('Start')?.click());

    expect(shown('Cancel')).toBe(true);
    expect(shown('Do it')).toBe(true);
    expect(shown('Start')).toBe(false);
    expect(button('Cancel')?.parentElement?.parentElement).toBe(
      button('Start')?.parentElement?.parentElement,
    );
  });

  it('acts only on the second press, and shows a refusal', async () => {
    onConfirm.mockResolvedValueOnce('No.');

    await act(async () => button('Start')?.click());
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => button('Do it')?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('No.');
  });

  it('backs out on Cancel', async () => {
    await act(async () => button('Start')?.click());
    await act(async () => button('Cancel')?.click());

    expect(shown('Start')).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('backs out on a press anywhere else, or Escape', async () => {
    await act(async () => button('Start')?.click());
    await act(async () =>
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })),
    );
    expect(shown('Start')).toBe(true);

    await act(async () => button('Start')?.click());
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    );
    expect(shown('Start')).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('stays asking on a press on its own buttons', async () => {
    await act(async () => button('Start')?.click());
    await act(async () =>
      button('Do it')?.dispatchEvent(
        new Event('pointerdown', { bubbles: true }),
      ),
    );

    expect(shown('Do it')).toBe(true);
  });
});
