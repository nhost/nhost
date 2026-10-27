// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BackendStatus from '@/components/BackendStatus';

const health = vi.hoisted(() => ({ isBackendReachable: vi.fn() }));

vi.mock('@/lib/nhost/health', () => health);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function render(): Promise<void> {
  await act(async () => root.render(<BackendStatus />));
}

const link = (): HTMLAnchorElement | null => container.querySelector('a');

describe('BackendStatus', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    health.isBackendReachable.mockReset();
  });

  it('links to the local dashboard while the stack answers', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', '');
    health.isBackendReachable.mockResolvedValue(true);

    await render();

    expect(container.textContent).toContain('Connected: Nhost Local ↗');
    expect(link()?.getAttribute('href')).toBe(
      'https://local.dashboard.local.nhost.run',
    );
  });

  it('drops the link once the local stack stops answering', async () => {
    vi.useFakeTimers();
    health.isBackendReachable.mockResolvedValueOnce(true);
    await render();
    expect(link()).not.toBeNull();

    health.isBackendReachable.mockResolvedValue(false);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(container.textContent).toBe('Offline: Nhost Local');
    expect(link()).toBeNull();
  });
});
