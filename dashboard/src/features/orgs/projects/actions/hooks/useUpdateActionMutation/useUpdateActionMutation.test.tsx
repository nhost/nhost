import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { HASURA_API_URL } from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type {
  ActionItem,
  CreateActionArgs,
  CustomTypes,
} from '@/utils/hasura-api/generated/schemas';
import useUpdateActionMutation from './useUpdateActionMutation';

const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'test-secret' } },
};

const originalAction: ActionItem = {
  name: 'login',
  definition: {
    handler: 'https://example.com/old',
    output_type: 'SampleOutput',
    type: 'mutation',
  },
};

const args: CreateActionArgs = {
  name: 'login',
  definition: {
    handler: 'https://example.com/login',
    output_type: 'SampleOutput',
    type: 'mutation',
    kind: 'synchronous',
    arguments: [],
    headers: [],
    forward_client_headers: false,
    timeout: 30,
  },
};

const customTypes: CustomTypes = {
  scalars: [],
  enums: [],
  input_objects: [],
  objects: [{ name: 'SampleOutput', fields: [{ name: 'token', type: 'String!' }] }],
};

const variables = { args, customTypes, previousCustomTypes: {}, originalAction };

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

describe('useUpdateActionMutation', () => {
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

  it('on platform, updates the action via the metadata bulk API', async () => {
    mocks.useIsPlatform.mockReturnValue(true);

    const { result } = renderHook(() => useUpdateActionMutation(), { wrapper });
    await result.current.mutateAsync(variables);

    expect(metadataBody).toEqual({
      type: 'bulk',
      args: [
        { type: 'set_custom_types', args: customTypes },
        { type: 'update_action', args },
      ],
    });
    expect(migrationBody).toBeNull();
  });

  it('off platform, updates the action via the migrations API', async () => {
    mocks.useIsPlatform.mockReturnValue(false);

    const { result } = renderHook(() => useUpdateActionMutation(), { wrapper });
    await result.current.mutateAsync(variables);

    expect(migrationBody?.name).toBe('modify_action_login_to_login');
    expect(migrationBody?.up).toEqual([
      { type: 'set_custom_types', args: customTypes },
      { type: 'update_action', args },
    ]);
    expect(metadataBody).toBeNull();
  });

  it('invalidates the export-metadata cache on success', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateActionMutation(), { wrapper });
    await result.current.mutateAsync(variables);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
      }),
    );
  });
});
