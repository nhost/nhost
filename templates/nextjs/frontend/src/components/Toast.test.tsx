// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ToastProvider, { useToast } from '@/components/Toast';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let toast: ReturnType<typeof useToast>;

function Grab() {
  toast = useToast();
  return null;
}

const shown = (): string | null =>
  container.querySelector('[role="status"]')?.textContent || null;

describe('toast', () => {
  beforeEach(async () => {
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <ToastProvider>
          <Grab />
        </ToastProvider>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('takes a toast down early when asked', async () => {
    let dismiss: VoidFunction = () => undefined;
    await act(async () => {
      dismiss = toast('Key copied');
    });
    expect(shown()).toBe('Key copied');

    await act(async () => dismiss());

    expect(shown()).toBeNull();
  });

  // The one that replaced it is about something else.
  it('leaves a toast that has replaced it', async () => {
    let dismiss: VoidFunction = () => undefined;
    await act(async () => {
      dismiss = toast('Key copied');
    });
    await act(async () => {
      toast('Two-factor is on');
    });

    await act(async () => dismiss());

    expect(shown()).toBe('Two-factor is on');
  });
});
