import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import useLogicalModelPermissionMutation from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';
import type {
  CreateLogicalModelSelectPermissionArgs,
  LogicalModelSelectPermission,
} from '@/utils/hasura-api/generated/schemas';

const API = 'https://local.hasura.local.nhost.run';
const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'secret' } },
};
const original: LogicalModelSelectPermission = {
  columns: ['id'],
  filter: { profile: { active: { _eq: true } } },
};
const args: CreateLogicalModelSelectPermissionArgs = {
  source: 'default',
  name: 'author_result',
  role: 'user',
  permission: { columns: '*', filter: {} },
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

describe('useLogicalModelPermissionMutation', () => {
  beforeAll(() => server.listen());
  beforeEach(() => {
    queryClient.clear();
    server.resetHandlers();
    metadataBody = undefined;
    migrationBody = undefined;
    mocks.useProject.mockReturnValue({ project });
    mocks.refetch.mockResolvedValue({ data: 244 });
  });
  afterAll(() => server.close());

  it('uses a fresh resource version and bulk_atomic drop/create for platform edits', async () => {
    mocks.useIsPlatform.mockReturnValue(true);
    const { result } = renderHook(
      () => useLogicalModelPermissionMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args, original });

    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(metadataBody).toEqual({
      type: 'bulk_atomic',
      resource_version: 244,
      args: [
        {
          type: 'pg_drop_logical_model_select_permission',
          args: { source: 'default', name: args.name, role: args.role },
        },
        {
          type: 'pg_create_logical_model_select_permission',
          args,
        },
      ],
    });
  });

  it('sends local edits with exact prior-permission restoration', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const { result } = renderHook(
      () => useLogicalModelPermissionMutation({ type: 'edit' }),
      { wrapper },
    );

    await result.current.mutateAsync({ args, original });

    expect(migrationBody).toEqual({
      name: 'update_logical_model_select_permission_author_result_user',
      datasource: 'default',
      skip_execution: false,
      up: [
        {
          type: 'pg_drop_logical_model_select_permission',
          args: { source: 'default', name: args.name, role: args.role },
        },
        { type: 'pg_create_logical_model_select_permission', args },
      ],
      down: [
        {
          type: 'pg_drop_logical_model_select_permission',
          args: { source: 'default', name: args.name, role: args.role },
        },
        {
          type: 'pg_create_logical_model_select_permission',
          args: {
            source: 'default',
            name: args.name,
            role: args.role,
            permission: original,
          },
        },
      ],
    });
  });

  it('supports create and delete on both request routes', async () => {
    mocks.useIsPlatform.mockReturnValue(true);
    const platform = renderHook(
      () => useLogicalModelPermissionMutation({ type: 'add' }),
      { wrapper },
    );
    await platform.result.current.mutateAsync({ args });
    expect(metadataBody).toMatchObject({
      type: 'bulk_atomic',
      args: [{ type: 'pg_create_logical_model_select_permission' }],
    });

    mocks.useIsPlatform.mockReturnValue(false);
    const local = renderHook(
      () => useLogicalModelPermissionMutation({ type: 'delete' }),
      { wrapper },
    );
    await local.result.current.mutateAsync({
      name: args.name,
      role: args.role,
      original,
    });
    expect(migrationBody).toMatchObject({
      name: 'delete_logical_model_select_permission_author_result_user',
      up: [{ type: 'pg_drop_logical_model_select_permission' }],
      down: [
        {
          type: 'pg_create_logical_model_select_permission',
          args: { permission: original },
        },
      ],
    });
  });

  it('invalidates export metadata after success only', async () => {
    mocks.useIsPlatform.mockReturnValue(false);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => useLogicalModelPermissionMutation({ type: 'add' }),
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
