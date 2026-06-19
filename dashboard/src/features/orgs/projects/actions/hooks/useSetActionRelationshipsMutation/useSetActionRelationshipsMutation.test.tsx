import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { HASURA_API_URL } from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type { CustomTypes } from '@/utils/hasura-api/generated/schemas';
import useSetActionRelationshipsMutation from './useSetActionRelationshipsMutation';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const customTypes: CustomTypes = {
  scalars: [],
  enums: [],
  input_objects: [],
  objects: [
    {
      name: 'ExchangeRatesOutput',
      fields: [{ name: 'base', type: 'String!' }],
    },
  ],
};

const variables = {
  customTypes,
  previousCustomTypes: {},
  relationshipName: 'animal',
  outputTypeName: 'ExchangeRatesOutput',
  mode: 'save' as const,
};

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

let metadataBody: unknown = null;
let migrationBody: { name: string; up: unknown } | null = null;

const server = setupServer(
  http.post(`${HASURA_API_URL}/v1/metadata`, async ({ request }) => {
    metadataBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
  http.post(`${HASURA_API_URL}/apis/migrate`, async ({ request }) => {
    migrationBody = (await request.json()) as typeof migrationBody;
    return HttpResponse.json({ message: 'success' });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useSetActionRelationshipsMutation', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    server.resetHandlers();
    queryClient.clear();
    metadataBody = null;
    migrationBody = null;
    mocks.useProject.mockReturnValue({ project });
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(() => server.close());

  it('on platform, persists relationships via set_custom_types in the bulk API', async () => {
    mocks.useIsPlatform.mockReturnValue(true);

    const { result } = renderHook(() => useSetActionRelationshipsMutation(), {
      wrapper,
    });
    await result.current.mutateAsync(variables);

    expect(metadataBody).toEqual({
      type: 'bulk',
      args: [{ type: 'set_custom_types', args: customTypes }],
    });
    expect(migrationBody).toBeNull();
  });

  it('off platform, persists relationships via the migrations API named after the mode', async () => {
    mocks.useIsPlatform.mockReturnValue(false);

    const { result } = renderHook(() => useSetActionRelationshipsMutation(), {
      wrapper,
    });
    await result.current.mutateAsync(variables);

    expect(migrationBody?.name).toBe('save_rel_animal_on_ExchangeRatesOutput');
    expect(migrationBody?.up).toEqual([
      { type: 'set_custom_types', args: customTypes },
    ]);
    expect(metadataBody).toBeNull();
  });

  it('invalidates the export-metadata cache on success', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetActionRelationshipsMutation(), {
      wrapper,
    });
    await result.current.mutateAsync(variables);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
      }),
    );
  });
});
