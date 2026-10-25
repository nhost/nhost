// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyUserId from '@/app/account/CopyUserId';
import ToastProvider from '@/components/Toast';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const id = '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24';
const writeText = vi.fn<(text: string) => Promise<void>>();

let container: HTMLElement;
let root: Root;

const chip = (): HTMLButtonElement | null =>
  container.querySelector('button[aria-label="Copy user ID"]');

const toast = (): string | null =>
  container.querySelector('[role="status"]')?.textContent ?? null;

describe('copy user id', () => {
  beforeEach(async () => {
    writeText.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <ToastProvider>
          <CopyUserId id={id} />
        </ToastProvider>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the ends of the id, and the whole of it on hover', () => {
    expect(chip()?.textContent).toContain('2c35…2e24');
    expect(chip()?.title).toBe(id);
  });

  it('copies the whole id and says so', async () => {
    writeText.mockResolvedValueOnce();

    await act(async () => chip()?.click());

    expect(writeText).toHaveBeenCalledWith(id);
    expect(toast()).toBe('User ID copied');
  });

  it('says so when the clipboard refuses', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    writeText.mockRejectedValueOnce(new Error('denied'));

    await act(async () => chip()?.click());

    expect(toast()).toBe('Could not copy the user ID');
  });
});
