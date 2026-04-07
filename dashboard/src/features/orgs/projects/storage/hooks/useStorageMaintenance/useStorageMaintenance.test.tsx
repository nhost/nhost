import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import useStorageMaintenance from './useStorageMaintenance';

const STORAGE_BASE = 'https://local.storage.local.nhost.run/v1';

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

const server = setupServer(tokenQuery);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useStorageMaintenance', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
    queryClient.clear();
    mocks.useIsPlatform.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('should not fetch when adminSecret is falsy', async () => {
    const listOrphansSpy = vi.fn();
    const listBrokenSpy = vi.fn();

    server.use(
      http.post(`${STORAGE_BASE}/ops/list-orphans`, () => {
        listOrphansSpy();
        return HttpResponse.json({ files: [] });
      }),
      http.post(`${STORAGE_BASE}/ops/list-broken-metadata`, () => {
        listBrokenSpy();
        return HttpResponse.json({ metadata: [] });
      }),
    );

    mocks.useProject.mockReturnValue({
      project: {
        id: 'test-project',
        config: { hasura: { adminSecret: '' } },
      },
    });

    const { result } = renderHook(() => useStorageMaintenance(), { wrapper });

    await waitFor(() => {
      expect(result.current.orphanCount).toBe(0);
      expect(result.current.brokenMetadataCount).toBe(0);
    });

    expect(listOrphansSpy).not.toHaveBeenCalled();
    expect(listBrokenSpy).not.toHaveBeenCalled();
  });

  it('should pass x-hasura-admin-secret header to delete endpoints', async () => {
    const capturedHeaders: Record<string, string | null> = {};

    server.use(
      http.post(`${STORAGE_BASE}/ops/list-orphans`, () =>
        HttpResponse.json({ files: [{ id: 'o-1' }] }),
      ),
      http.post(`${STORAGE_BASE}/ops/list-broken-metadata`, () =>
        HttpResponse.json({ metadata: [{ id: 'b-1' }] }),
      ),
      http.post(`${STORAGE_BASE}/ops/delete-orphans`, ({ request }) => {
        capturedHeaders.deleteOrphans = request.headers.get(
          'x-hasura-admin-secret',
        );
        return HttpResponse.json({ files: [] });
      }),
      http.post(`${STORAGE_BASE}/ops/delete-broken-metadata`, ({ request }) => {
        capturedHeaders.deleteBroken = request.headers.get(
          'x-hasura-admin-secret',
        );
        return HttpResponse.json({ metadata: [] });
      }),
    );

    mocks.useProject.mockReturnValue({
      project: {
        id: 'test-project',
        config: { hasura: { adminSecret: 'my-secret-123' } },
      },
    });

    const { result } = renderHook(() => useStorageMaintenance(), { wrapper });

    await waitFor(() => {
      expect(result.current.orphanCount).toBe(1);
    });

    await result.current.deleteOrphans();
    await result.current.deleteBroken();

    expect(capturedHeaders.deleteOrphans).toBe('my-secret-123');
    expect(capturedHeaders.deleteBroken).toBe('my-secret-123');
  });
});
