// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRefresh } from '@/components/useRefresh';
import AuthProvider from '@/lib/nhost/AuthProvider';
import { useLoad } from '@/lib/useLoad';

vi.mock('@/lib/nhost/watchSession', () => ({
  watchSession: () => ({ checkRevoked: async () => undefined, stop: vi.fn() }),
}));

vi.mock('@/lib/nhost/client', () => ({
  nhost: { getUserSession: () => null },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let refresh: VoidFunction = () => undefined;

function Loaded({ load }: { load: () => Promise<string> }) {
  refresh = useRefresh();
  return <p>{useLoad(load) ?? 'loading'}</p>;
}

let container: HTMLElement;
let root: Root;

async function render(load: () => Promise<string>): Promise<void> {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AuthProvider>
          <Loaded load={load} />
        </AuthProvider>
      </MemoryRouter>,
    ),
  );
}

beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'));
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('useLoad', () => {
  it('shows what the load resolved to, and loads again on useRefresh()', async () => {
    let n = 0;
    await render(async () => `load ${++n}`);

    expect(container.textContent).toBe('load 1');

    await act(async () => refresh());

    expect(container.textContent).toBe('load 2');
  });

  it('loads once however often the page renders', async () => {
    const load = vi.fn(async () => 'loaded');
    await render(load);
    await render(load);

    expect(load).toHaveBeenCalledOnce();
  });

  // A slow first answer must not overwrite the one a refresh brought.
  it('drops an answer that a newer load overtook', async () => {
    const answers: Array<(value: string) => void> = [];
    await render(
      () =>
        new Promise<string>((resolve) => {
          answers.push(resolve);
        }),
    );
    await act(async () => refresh());

    await act(async () => answers[1]?.('second'));
    await act(async () => answers[0]?.('first'));

    expect(container.textContent).toBe('second');
  });

  it('keeps what it had when a load fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = false;
    await render(async () => {
      if (fail) {
        throw new Error('offline');
      }
      return 'loaded';
    });

    fail = true;
    await act(async () => refresh());

    expect(container.textContent).toBe('loaded');
  });
});
