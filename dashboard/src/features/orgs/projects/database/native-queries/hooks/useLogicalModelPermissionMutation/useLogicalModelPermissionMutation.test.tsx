import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import {
  type LogicalModelPermissionMutationType,
  useLogicalModelPermissionMutation,
} from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation';
import type { LogicalModelPermissionArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { queryClient, renderHook, waitFor } from '@/tests/testUtils';

const API = 'https://local.hasura.local.nhost.run';
const project = {
  subdomain: 'test-app',
  region: { name: 'us-east-1', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'secret' } },
};
const args: LogicalModelPermissionArgs = {
  name: 'author_result',
  role: 'user',
  permission: {
    columns: ['id', 'name'],
    filter: {
      _or: [
        { id: { _eq: 'X-Hasura-User-Id' } },
        { profile: { active: { _eq: true } } },
      ],
    },
  },
};
const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useIsPlatform: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({ query: { dataSourceSlug: 'default' } }),
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

interface MetadataRequest {
  type?: string;
  resource_version?: number;
}

const migrationSuccess = { name: '0_update_native_query_metadata' };
let metadataBodies: MetadataRequest[] = [];
let migrationBodies: unknown[] = [];
let requestOrder: string[] = [];
let unexpectedRequests: string[] = [];
let nextResourceVersion: number | undefined = 244;
let metadataStatus = 200;
let migrationStatus = 200;
let exportMetadataStatus = 200;
let migrationFinished: Promise<void> | undefined;

const server = setupServer(
  http.post(`${API}/v1/metadata`, async ({ request }) => {
    const isPlatform = mocks.useIsPlatform();
    const body = (await request.json()) as MetadataRequest;
    metadataBodies.push(body);

    if (body.type === 'export_metadata') {
      requestOrder.push('resource-version');
      return exportMetadataStatus === 200
        ? HttpResponse.json({
            resource_version: nextResourceVersion,
            metadata: {
              sources: [{ name: 'default' }, { name: 'analytics' }],
            },
          })
        : HttpResponse.json(
            { error: 'resource version failed' },
            { status: 500 },
          );
    }

    if (!isPlatform) {
      unexpectedRequests.push(`Local metadata write: ${JSON.stringify(body)}`);
      return HttpResponse.json(
        { error: 'Unexpected local metadata write' },
        { status: 500 },
      );
    }
    requestOrder.push('metadata');
    return metadataStatus === 200
      ? HttpResponse.json({ message: 'success' })
      : HttpResponse.json({ error: 'metadata failed' }, { status: 500 });
  }),
  http.post(`${API}/apis/migrate`, async ({ request }) => {
    requestOrder.push('migration');
    migrationBodies.push(await request.json());
    await migrationFinished;
    return migrationStatus === 200
      ? HttpResponse.json(migrationSuccess)
      : HttpResponse.json({ error: 'migration failed' }, { status: 500 });
  }),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
const original = { columns: ['id'], filter: {} };
const SOURCE = 'default';
const RESOURCE_VERSION = 244;
const dropStep = {
  type: 'pg_drop_logical_model_select_permission',
  args: { source: SOURCE, name: args.name, role: args.role },
};
const createStep = {
  type: 'pg_create_logical_model_select_permission',
  args: { ...args, source: SOURCE },
};
const restoreStep = {
  type: 'pg_create_logical_model_select_permission',
  args: { ...args, source: SOURCE, permission: original },
};

const metadataQueryKey = [EXPORT_METADATA_QUERY_KEY, project.subdomain];

function renderMutation<T extends LogicalModelPermissionMutationType>(
  type: T,
  onSuccess = vi.fn(),
) {
  const { result } = renderHook(
    () =>
      useLogicalModelPermissionMutation({
        type,
        mutationOptions: { onSuccess },
      }),
    { wrapper },
  );
  return result;
}

describe('useLogicalModelPermissionMutation', () => {
  beforeAll(() =>
    server.listen({
      onUnhandledRequest(request, print) {
        unexpectedRequests.push(`${request.method} ${request.url}`);
        print.error();
      },
    }),
  );
  beforeEach(() => {
    queryClient.clear();
    metadataBodies = [];
    migrationBodies = [];
    requestOrder = [];
    unexpectedRequests = [];
    nextResourceVersion = 244;
    metadataStatus = 200;
    migrationStatus = 200;
    exportMetadataStatus = 200;
    migrationFinished = undefined;
    mocks.useProject.mockReturnValue({ project, loading: false });
    mocks.useIsPlatform.mockReturnValue(false);
  });
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    queryClient.clear();
    expect(unexpectedRequests).toEqual([]);
  });
  afterAll(() => server.close());

  describe('local (migrations API)', () => {
    it('creates a permission with a rollback that drops it', async () => {
      const result = renderMutation('add');

      await expect(
        result.current.mutateAsync({ resourceVersion: RESOURCE_VERSION, args }),
      ).resolves.toEqual(migrationSuccess);

      expect(requestOrder).toEqual(['migration']);
      expect(migrationBodies).toEqual([
        {
          name: 'create_logical_model_select_permission_author_result_user',
          datasource: SOURCE,
          up: [createStep],
          down: [dropStep],
        },
      ]);
    });

    it('updates a permission by re-creating it, with a rollback that restores the original', async () => {
      const result = renderMutation('edit');

      await expect(
        result.current.mutateAsync({
          resourceVersion: RESOURCE_VERSION,
          args,
          original,
        }),
      ).resolves.toEqual(migrationSuccess);

      expect(requestOrder).toEqual(['migration']);
      expect(migrationBodies).toEqual([
        {
          name: 'update_logical_model_select_permission_author_result_user',
          datasource: SOURCE,
          up: [dropStep, createStep],
          down: [dropStep, restoreStep],
        },
      ]);
    });

    it('deletes a permission with a rollback that restores the original', async () => {
      const result = renderMutation('delete');

      await expect(
        result.current.mutateAsync({
          resourceVersion: RESOURCE_VERSION,
          name: args.name,
          role: args.role,
          original,
        }),
      ).resolves.toEqual(migrationSuccess);

      expect(requestOrder).toEqual(['migration']);
      expect(migrationBodies).toEqual([
        {
          name: 'drop_logical_model_select_permission_author_result_user',
          datasource: SOURCE,
          up: [dropStep],
          down: [restoreStep],
        },
      ]);
    });

    it('waits for the migration before calling onSuccess and invalidating the metadata', async () => {
      const onSuccess = vi.fn();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const result = renderMutation('edit', onSuccess);
      const completion = Promise.withResolvers<void>();
      migrationFinished = completion.promise;
      const mutation = result.current.mutateAsync({
        resourceVersion: RESOURCE_VERSION,
        args,
        original,
      });

      try {
        await waitFor(() => expect(migrationBodies).toHaveLength(1));
        expect(onSuccess).not.toHaveBeenCalled();
        expect(invalidate).not.toHaveBeenCalled();
      } finally {
        completion.resolve();
        await expect(mutation).resolves.toEqual(migrationSuccess);
      }

      expect(onSuccess).toHaveBeenCalledOnce();
      expect(onSuccess.mock.calls[0][0]).toEqual(migrationSuccess);
      expect(invalidate).toHaveBeenCalledExactlyOnceWith({
        queryKey: metadataQueryKey,
      });
    });

    it('surfaces a failed migration without invalidating and permits an explicit retry', async () => {
      migrationStatus = 500;
      const onSuccess = vi.fn();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const result = renderMutation('edit', onSuccess);
      const variables = { resourceVersion: RESOURCE_VERSION, args, original };

      await expect(result.current.mutateAsync(variables)).rejects.toThrow(
        'migration failed',
      );
      expect(migrationBodies).toHaveLength(1);
      expect(metadataBodies).toEqual([]);
      expect(invalidate).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();

      migrationStatus = 200;
      await expect(result.current.mutateAsync(variables)).resolves.toEqual(
        migrationSuccess,
      );
      expect(migrationBodies).toHaveLength(2);
      expect(migrationBodies[1]).toEqual(migrationBodies[0]);
      expect(requestOrder).toEqual(['migration', 'migration']);
      expect(invalidate).toHaveBeenCalledExactlyOnceWith({
        queryKey: metadataQueryKey,
      });
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  describe('platform (metadata API)', () => {
    beforeEach(() => {
      mocks.useIsPlatform.mockReturnValue(true);
    });

    it('creates a permission in one bulk request', async () => {
      const result = renderMutation('add');

      await expect(
        result.current.mutateAsync({ resourceVersion: RESOURCE_VERSION, args }),
      ).resolves.toEqual({ message: 'success' });

      expect(requestOrder).toEqual(['metadata']);
      expect(metadataBodies).toEqual([
        {
          type: 'bulk',
          resource_version: RESOURCE_VERSION,
          args: [createStep],
        },
      ]);
      expect(migrationBodies).toEqual([]);
    });

    it('updates a permission by dropping and re-creating it in one bulk request', async () => {
      const result = renderMutation('edit');

      await expect(
        result.current.mutateAsync({
          resourceVersion: RESOURCE_VERSION,
          args,
          original,
        }),
      ).resolves.toEqual({ message: 'success' });

      expect(requestOrder).toEqual(['metadata']);
      expect(metadataBodies).toEqual([
        {
          type: 'bulk',
          resource_version: RESOURCE_VERSION,
          args: [dropStep, createStep],
        },
      ]);
      expect(migrationBodies).toEqual([]);
    });

    it('deletes a permission in one bulk request', async () => {
      const result = renderMutation('delete');

      await expect(
        result.current.mutateAsync({
          resourceVersion: RESOURCE_VERSION,
          name: args.name,
          role: args.role,
          original,
        }),
      ).resolves.toEqual({ message: 'success' });

      expect(requestOrder).toEqual(['metadata']);
      expect(metadataBodies).toEqual([
        {
          type: 'bulk',
          resource_version: RESOURCE_VERSION,
          args: [dropStep],
        },
      ]);
      expect(migrationBodies).toEqual([]);
    });

    it('does not migrate, invalidate or call onSuccess when the metadata request fails', async () => {
      metadataStatus = 500;
      const onSuccess = vi.fn();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const result = renderMutation('edit', onSuccess);

      await expect(
        result.current.mutateAsync({
          resourceVersion: RESOURCE_VERSION,
          args,
          original,
        }),
      ).rejects.toThrow('metadata failed');

      expect(requestOrder).toEqual(['metadata']);
      expect(migrationBodies).toEqual([]);
      expect(invalidate).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
