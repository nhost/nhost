import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import useLogicalModelMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type {
  LogicalModelItem,
  TrackLogicalModelArgs,
} from '@/utils/hasura-api/generated/schemas';

const API = 'https://local.hasura.local.nhost.run';
const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'secret' } },
};
const args: TrackLogicalModelArgs = {
  source: 'default',
  name: 'renamed_result',
  description: 'Updated result description',
  fields: [
    {
      name: 'id',
      type: { scalar: 'uuid', nullable: false },
      description: 'Updated identifier description',
    },
  ],
};
const original: LogicalModelItem = {
  name: 'result',
  description: '  External result description  ',
  fields: [
    {
      name: 'id',
      type: { scalar: 'text', nullable: true },
      description: '  External identifier description  ',
    },
  ],
  select_permissions: [
    { role: 'user', permission: { columns: '*', filter: {} } },
  ],
};
const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));
vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: () => ({ refetch: mocks.refetch }),
  }),
);

let metadataBody: unknown;
let migrationBody: unknown;
const server = setupServer(
  http.post(`${API}/v1/metadata`, async ({ request }) => {
    metadataBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
  http.post(`${API}/apis/migrate`, async ({ request }) => {
    migrationBody = await request.json();
    return HttpResponse.json({ message: 'success' });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useLogicalModelMetadataMutation', () => {
  beforeAll(() => server.listen());
  beforeEach(() => {
    queryClient.clear();
    server.resetHandlers();
    metadataBody = undefined;
    migrationBody = undefined;
    mocks.useProject.mockReturnValue({ project });
    mocks.refetch.mockResolvedValue({ data: 91 });
  });
  afterAll(() => server.close());

  it('awaits a fresh version and sends platform edits as mixed bulk_atomic operations', async () => {
    mocks.useIsPlatform.mockReturnValue(true);
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args, original });

    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(metadataBody).toEqual({
      type: 'bulk_atomic',
      resource_version: 91,
      args: [
        {
          type: 'pg_untrack_logical_model',
          args: { source: 'default', name: original.name },
        },
        { type: 'pg_track_logical_model', args },
        {
          type: 'pg_create_logical_model_select_permission',
          args: {
            source: 'default',
            name: args.name,
            role: 'user',
            permission: original.select_permissions?.[0].permission,
          },
        },
      ],
    });
    expect(migrationBody).toBeUndefined();
  });

  it('sends local edits as ordered lossless migration arrays', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args, original });

    expect(migrationBody).toEqual({
      name: 'update_logical_model_result',
      datasource: 'default',
      skip_execution: false,
      up: [
        {
          type: 'pg_untrack_logical_model',
          args: { source: 'default', name: original.name },
        },
        { type: 'pg_track_logical_model', args },
        {
          type: 'pg_create_logical_model_select_permission',
          args: {
            source: 'default',
            name: args.name,
            role: 'user',
            permission: original.select_permissions?.[0].permission,
          },
        },
      ],
      down: [
        {
          type: 'pg_drop_logical_model_select_permission',
          args: { source: 'default', name: args.name, role: 'user' },
        },
        {
          type: 'pg_untrack_logical_model',
          args: { source: 'default', name: args.name },
        },
        {
          type: 'pg_track_logical_model',
          args: {
            source: 'default',
            name: original.name,
            fields: original.fields,
            description: original.description,
          },
        },
        {
          type: 'pg_create_logical_model_select_permission',
          args: {
            source: 'default',
            name: original.name,
            role: 'user',
            permission: original.select_permissions?.[0].permission,
          },
        },
      ],
    });
  });

  it('restores exact descriptions and permissions in local delete rollback', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'delete' }),
      { wrapper },
    );

    await result.current.mutateAsync({ original });

    expect(migrationBody).toEqual({
      name: 'delete_logical_model_result',
      datasource: 'default',
      skip_execution: false,
      up: [
        {
          type: 'pg_untrack_logical_model',
          args: { source: 'default', name: original.name },
        },
      ],
      down: [
        {
          type: 'pg_track_logical_model',
          args: {
            source: 'default',
            name: original.name,
            fields: original.fields,
            description: original.description,
          },
        },
        {
          type: 'pg_create_logical_model_select_permission',
          args: {
            source: 'default',
            name: original.name,
            role: 'user',
            permission: original.select_permissions?.[0].permission,
          },
        },
      ],
    });
  });

  it('invalidates metadata only after success', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => useLogicalModelMetadataMutation({ type: 'add' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project.subdomain],
      }),
    );

    invalidate.mockClear();
    server.use(
      http.post(`${API}/apis/migrate`, () =>
        HttpResponse.json({ error: 'failed' }, { status: 500 }),
      ),
    );
    await expect(result.current.mutateAsync({ args })).rejects.toThrow(
      'failed',
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
