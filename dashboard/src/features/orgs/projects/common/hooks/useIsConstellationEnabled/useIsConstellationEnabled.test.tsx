import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import useIsConstellationEnabled from './useIsConstellationEnabled';

const CONFIG_SERVER_URL =
  'https://local.dashboard.local.nhost.run/v1/configserver/graphql';

// useLocalMimirClient reads this at render time to build its Apollo client.
process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL = CONFIG_SERVER_URL;

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

let constellationValue: { version: string } | null = null;
let configRequests = 0;

const server = setupServer(
  http.post(CONFIG_SERVER_URL, async () => {
    configRequests += 1;
    return HttpResponse.json({
      data: {
        config: { experimental: { constellation: constellationValue } },
      },
    });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useIsConstellationEnabled', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    server.resetHandlers();
    queryClient.clear();
    constellationValue = null;
    configRequests = 0;
    mocks.useProject.mockReturnValue({ project: { id: 'test-app-id' } });
    mocks.useIsPlatform.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('returns true when the config exposes an experimental constellation block', async () => {
    constellationValue = { version: '0.1.0' };

    const { result } = renderHook(() => useIsConstellationEnabled(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isConstellationEnabled).toBe(true);
  });

  it('returns false when constellation is absent from the config', async () => {
    constellationValue = null;

    const { result } = renderHook(() => useIsConstellationEnabled(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isConstellationEnabled).toBe(false);
  });

  it('skips the config query on the platform', async () => {
    mocks.useIsPlatform.mockReturnValue(true);

    const { result } = renderHook(() => useIsConstellationEnabled(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isConstellationEnabled).toBe(false);
    expect(configRequests).toBe(0);
  });

  it('skips the config query when no local project is selected', async () => {
    mocks.useProject.mockReturnValue({ project: null });

    const { result } = renderHook(() => useIsConstellationEnabled(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isConstellationEnabled).toBe(false);
    expect(configRequests).toBe(0);
  });

  it('reports undefined (not false) while the config query is in flight', async () => {
    constellationValue = { version: '0.1.0' };

    const { result } = renderHook(() => useIsConstellationEnabled(), {
      wrapper,
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.isConstellationEnabled).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isConstellationEnabled).toBe(true);
  });
});
