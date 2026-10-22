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

  it('says checking, without a link, until the first answer', async () => {
    health.isBackendReachable.mockReturnValue(new Promise(() => {}));

    await render();

    expect(container.textContent).toBe('Checking: Nhost Local');
    expect(link()).toBeNull();
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

  it('links the cloud project when its organization is known', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');
    vi.stubEnv('NEXT_PUBLIC_NHOST_ORG_SLUG', 'acme');
    health.isBackendReachable.mockResolvedValue(true);

    await render();

    expect(container.textContent).toContain('Connected: Nhost Cloud ↗');
    expect(link()?.getAttribute('href')).toBe(
      'https://app.nhost.io/orgs/acme/projects/abcdefgh',
    );
  });

  // The dashboard has no URL that finds a project from its subdomain, so the
  // subdomain is kept on the link for picking it there.
  it('links the project picker when the organization is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');
    vi.stubEnv('NEXT_PUBLIC_NHOST_ORG_SLUG', '');
    health.isBackendReachable.mockResolvedValue(true);

    await render();

    expect(link()?.title).toBe('abcdefgh in eu-central-1');
    expect(link()?.getAttribute('href')).toBe(
      'https://app.nhost.io/orgs/_/projects/_',
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

  it('keeps the cloud dashboard link while the project is offline', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');
    health.isBackendReachable.mockResolvedValue(false);

    await render();

    expect(container.textContent).toBe('Offline: Nhost Cloud');
    expect(link()?.href).toContain('app.nhost.io');
  });

  it('checks again when the tab comes back into view', async () => {
    health.isBackendReachable.mockResolvedValueOnce(false);
    await render();
    expect(container.textContent).toContain('Offline');

    health.isBackendReachable.mockResolvedValue(true);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(container.textContent).toContain('Connected');
  });
});
