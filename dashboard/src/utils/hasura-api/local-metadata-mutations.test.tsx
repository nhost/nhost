import { QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useCreateRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRelationshipMutation';
import { useCreateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation';
import { useDeleteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteRelationshipMutation';
import { useRenameRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useRenameRelationshipMutation';
import { useSetFunctionCustomizationMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetFunctionCustomizationMutation';
import { useCreateCronTriggerMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useCreateCronTriggerMutation';
import { useDeleteCronTriggerMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useDeleteCronTriggerMutation';
import { useClearMetadataMutation } from '@/features/orgs/projects/graphql/metadata/hooks/useClearMetadataMutation';
import { useDropInconsistentMetadataMutation } from '@/features/orgs/projects/graphql/metadata/hooks/useDropInconsistentMetadataMutation';
import { useCreateRemoteSchemaMutation } from '@/features/orgs/projects/remote-schemas/hooks/useCreateRemoteSchemaMutation';
import { useCreateRemoteSchemaRelationshipMutation } from '@/features/orgs/projects/remote-schemas/hooks/useCreateRemoteSchemaRelationshipMutation';
import { useDeleteRemoteSchemaRelationshipMutation } from '@/features/orgs/projects/remote-schemas/hooks/useDeleteRemoteSchemaRelationshipMutation';
import { useUpdateRemoteSchemaRelationshipMutation } from '@/features/orgs/projects/remote-schemas/hooks/useUpdateRemoteSchemaRelationshipMutation';
import { queryClient, renderHook } from '@/tests/testUtils';
import type {
  CreateCronTriggerArgs,
  CreateLocalRelationshipArgs,
  CreateRemoteRelationshipArgs,
  CreateRemoteSchemaRemoteRelationshipArgs,
  MigrationStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';

const APP_URL = 'http://hasura.local.test:8080';
const MIGRATION_URL = 'http://migration.local.test:9693/apis/migrate';
const ADMIN_SECRET = 'test-admin-secret';
const RESOURCE_VERSION = 42;
const SOURCE = 'analytics';
const TABLE = { schema: 'public', name: 'users' };
const METADATA_KEY = [EXPORT_METADATA_QUERY_KEY, 'test-project'];

vi.mock('@/features/orgs/projects/common/hooks/useAdminApiTarget', () => ({
  useAdminApiTarget: () => ({ appUrl: APP_URL, adminSecret: ADMIN_SECRET }),
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project: { subdomain: 'test-project' } }),
}));

const cronArgs: CreateCronTriggerArgs = {
  name: 'daily_report',
  webhook: '{{WEBHOOK_URL}}',
  schedule: '0 0 * * *',
  include_in_metadata: true,
  headers: [{ name: 'Authorization', value_from_env: 'WEBHOOK_TOKEN' }],
  payload: { report: true },
  retry_conf: { num_retries: 2 },
  request_transform: { version: 2, method: 'POST', template_engine: 'Kriti' },
  comment: 'Daily report',
};
const localArgs: CreateLocalRelationshipArgs = {
  name: 'profile',
  table: TABLE,
  source: SOURCE,
  using: {
    manual_configuration: {
      remote_table: { schema: 'public', name: 'profiles' },
      column_mapping: { id: 'user_id' },
    },
  },
};
const remoteArgs: CreateRemoteRelationshipArgs = {
  name: 'orders',
  table: TABLE,
  source: SOURCE,
  definition: {
    to_source: {
      source: 'default',
      table: { schema: 'public', name: 'orders' },
      relationship_type: 'array',
      field_mapping: { id: 'user_id' },
    },
  },
};
const remoteSchemaArgs: CreateRemoteSchemaRemoteRelationshipArgs = {
  remote_schema: 'catalog',
  type_name: 'User',
  name: 'profile',
  definition: {
    to_remote_schema: {
      remote_schema: 'profiles',
      lhs_fields: ['id'],
      remote_field: { user: { arguments: { id: '$id' } } },
    },
  },
};

interface MutationCase {
  name: string;
  useRun: () => () => Promise<unknown>;
  step: MigrationStep;
  datasource?: string;
  bulk?: 'bulk' | 'bulk_atomic';
  resourceVersion?: number;
  queryKeys?: unknown[][];
}

const cases: MutationCase[] = [
  ...[false, true].map(
    (replace): MutationCase => ({
      name: replace ? 'edit cron trigger' : 'create cron trigger',
      useRun() {
        const mutation = useCreateCronTriggerMutation();
        return () => mutation.mutateAsync({ args: { ...cronArgs, replace } });
      },
      step: { type: 'create_cron_trigger', args: { ...cronArgs, replace } },
      bulk: 'bulk',
      queryKeys: [METADATA_KEY, ['get-cron-triggers', 'test-project']],
    }),
  ),
  {
    name: 'delete cron trigger',
    useRun() {
      const mutation = useDeleteCronTriggerMutation();
      return () => mutation.mutateAsync({ cronTriggerName: cronArgs.name });
    },
    step: { type: 'delete_cron_trigger', args: { name: cronArgs.name } },
    queryKeys: [METADATA_KEY, ['get-cron-triggers', 'test-project']],
  },
  ...(
    ['pg_create_object_relationship', 'pg_create_array_relationship'] as const
  ).map(
    (type): MutationCase => ({
      name: type,
      useRun() {
        const mutation = useCreateRelationshipMutation();
        return () =>
          mutation.mutateAsync({
            args: localArgs,
            type,
            resourceVersion: RESOURCE_VERSION,
          });
      },
      step: { type, args: localArgs },
      datasource: SOURCE,
      bulk: 'bulk_atomic',
      resourceVersion: RESOURCE_VERSION,
      queryKeys: [METADATA_KEY, ['suggest-relationships', SOURCE]],
    }),
  ),
  ...[remoteArgs.definition, remoteSchemaArgs.definition].map(
    (definition, index): MutationCase => ({
      name:
        index === 0
          ? 'set remote table relationship'
          : 'set remote schema relationship on a table',
      useRun() {
        const mutation = useCreateRemoteRelationshipMutation();
        return () =>
          mutation.mutateAsync({
            args: { ...remoteArgs, definition },
            resourceVersion: RESOURCE_VERSION,
          });
      },
      step: {
        type: 'pg_create_remote_relationship',
        args: { ...remoteArgs, definition },
      },
      datasource: SOURCE,
      bulk: 'bulk',
      resourceVersion: RESOURCE_VERSION,
      queryKeys: [METADATA_KEY, ['suggest-relationships', SOURCE]],
    }),
  ),
  ...(['local', 'remote'] as const).map(
    (type): MutationCase => ({
      name: `delete ${type} relationship`,
      useRun() {
        const mutation = useDeleteRelationshipMutation();
        return () =>
          mutation.mutateAsync({
            type,
            args: { table: TABLE, source: SOURCE, relationshipName: 'profile' },
            resourceVersion: RESOURCE_VERSION,
          });
      },
      step:
        type === 'local'
          ? {
              type: 'pg_drop_relationship',
              args: { table: TABLE, source: SOURCE, relationship: 'profile' },
            }
          : {
              type: 'pg_delete_remote_relationship',
              args: { table: TABLE, source: SOURCE, name: 'profile' },
            },
      datasource: SOURCE,
      bulk: 'bulk_atomic',
      resourceVersion: RESOURCE_VERSION,
      queryKeys: [METADATA_KEY, ['suggest-relationships', SOURCE]],
    }),
  ),
  {
    name: 'rename relationship',
    useRun() {
      const mutation = useRenameRelationshipMutation();
      return () =>
        mutation.mutateAsync({
          args: {
            table: TABLE,
            source: SOURCE,
            name: 'profile',
            new_name: 'user_profile',
          },
          resourceVersion: RESOURCE_VERSION,
        });
    },
    step: {
      type: 'pg_rename_relationship',
      args: {
        table: TABLE,
        source: SOURCE,
        name: 'profile',
        new_name: 'user_profile',
      },
    },
    datasource: SOURCE,
    bulk: 'bulk',
    resourceVersion: RESOURCE_VERSION,
    queryKeys: [METADATA_KEY],
  },
  ...[
    {},
    {
      custom_name: 'search',
      custom_root_fields: { function: 'find_users' },
      session_argument: 'session',
    },
  ].map(
    (configuration, index): MutationCase => ({
      name:
        index === 0
          ? 'reset function customization'
          : 'set function customization',
      useRun() {
        const mutation = useSetFunctionCustomizationMutation();
        return () =>
          mutation.mutateAsync({
            args: {
              function: { schema: 'public', name: 'search_users' },
              configuration,
              ...(index === 0 ? {} : { source: SOURCE }),
            },
          });
      },
      step: {
        type: 'pg_set_function_customization',
        args: {
          function: { schema: 'public', name: 'search_users' },
          configuration,
          ...(index === 0 ? {} : { source: SOURCE }),
        },
      },
      datasource: index === 0 ? 'default' : SOURCE,
      queryKeys: [METADATA_KEY],
    }),
  ),
  {
    name: 'create remote schema',
    useRun() {
      const mutation = useCreateRemoteSchemaMutation();
      return () =>
        mutation.mutateAsync({
          args: {
            name: 'catalog',
            definition: { url: 'https://example.com/graphql' },
            comment: 'Products',
          },
        });
    },
    step: {
      type: 'add_remote_schema',
      args: {
        name: 'catalog',
        definition: { url: 'https://example.com/graphql' },
        comment: 'Products',
      },
    },
  },
  {
    name: 'create remote schema relationship',
    useRun() {
      const mutation = useCreateRemoteSchemaRelationshipMutation();
      return () => mutation.mutateAsync({ args: remoteSchemaArgs });
    },
    step: {
      type: 'create_remote_schema_remote_relationship',
      args: remoteSchemaArgs,
    },
  },
  {
    name: 'update remote schema relationship',
    useRun() {
      const mutation = useUpdateRemoteSchemaRelationshipMutation();
      return () => mutation.mutateAsync({ args: remoteSchemaArgs });
    },
    step: {
      type: 'update_remote_schema_remote_relationship',
      args: remoteSchemaArgs,
    },
  },
  {
    name: 'delete remote schema relationship',
    useRun() {
      const mutation = useDeleteRemoteSchemaRelationshipMutation();
      return () =>
        mutation.mutateAsync({
          args: {
            remote_schema: 'catalog',
            type_name: 'User',
            name: 'profile',
          },
        });
    },
    step: {
      type: 'delete_remote_schema_remote_relationship',
      args: { remote_schema: 'catalog', type_name: 'User', name: 'profile' },
    },
  },
  {
    name: 'clear metadata',
    useRun() {
      const mutation = useClearMetadataMutation();
      return () => mutation.mutateAsync();
    },
    step: { type: 'clear_metadata', args: {} },
    queryKeys: [METADATA_KEY, ['inconsistent-metadata', 'test-project']],
  },
  {
    name: 'drop inconsistent metadata',
    useRun() {
      const mutation = useDropInconsistentMetadataMutation();
      return () => mutation.mutateAsync();
    },
    step: { type: 'drop_inconsistent_metadata', args: {} },
    queryKeys: [METADATA_KEY, ['inconsistent-metadata', 'test-project']],
  },
];

const requests: { url: string; body: unknown; adminSecret: string | null }[] =
  [];
const server = setupServer(
  ...[`${APP_URL}/v1/metadata`, MIGRATION_URL].map((url) =>
    http.post(url, async ({ request }) => {
      requests.push({
        url,
        body: await request.json(),
        adminSecret: request.headers.get('x-hasura-admin-secret'),
      });
      return HttpResponse.json(
        url === MIGRATION_URL
          ? { name: '0_test_metadata' }
          : { message: 'success' },
      );
    }),
  ),
);

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient.clear();
  requests.length = 0;
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
  vi.stubEnv('NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL', MIGRATION_URL);
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe.each(cases)(
  '$name',
  ({
    useRun,
    step,
    datasource = 'default',
    bulk,
    resourceVersion,
    queryKeys = [],
  }) => {
    it('persists locally through the configured CLI endpoint without SQL', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(useRun, { wrapper });
      await expect(result.current()).resolves.toEqual({
        name: '0_test_metadata',
      });
      expect(requests).toEqual([
        {
          url: MIGRATION_URL,
          adminSecret: ADMIN_SECRET,
          body: {
            name: expect.any(String),
            up: [step],
            down: [],
            datasource,
            skip_execution: false,
          },
        },
      ]);
      for (const queryKey of queryKeys) {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
      }
    });

    it('preserves the platform metadata request and resource version', async () => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
      const { result } = renderHook(useRun, { wrapper });
      await expect(result.current()).resolves.toEqual({ message: 'success' });
      expect(requests).toEqual([
        {
          url: `${APP_URL}/v1/metadata`,
          adminSecret: ADMIN_SECRET,
          body: bulk
            ? {
                type: bulk,
                args: [step],
                ...(resourceVersion
                  ? { resource_version: resourceVersion }
                  : {}),
              }
            : step,
        },
      ]);
    });

    it('rejects CLI failures without invalidating caches', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.post(MIGRATION_URL, () =>
          HttpResponse.json(
            { message: 'Cannot write metadata' },
            { status: 500 },
          ),
        ),
      );
      const { result } = renderHook(useRun, { wrapper });
      await expect(result.current()).rejects.toThrow('Cannot write metadata');
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  },
);

it('preserves typed conflicts and the Hasura origin from a different CLI host', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  server.use(
    http.post(MIGRATION_URL, () =>
      HttpResponse.json(
        {
          code: 'data_api_error',
          message: JSON.stringify({
            code: 'conflict',
            error:
              'metadata resource version referenced (42) did not match current version',
          }),
        },
        { status: 400 },
      ),
    ),
  );
  const { result } = renderHook(() => useCreateRemoteRelationshipMutation(), {
    wrapper,
  });
  await expect(
    result.current.mutateAsync({
      args: remoteArgs,
      resourceVersion: RESOURCE_VERSION,
    }),
  ).rejects.toMatchObject({
    name: 'MetadataVersionConflictError',
    origin: { appUrl: APP_URL },
  } satisfies Partial<MetadataVersionConflictError>);
});

it('preserves caller success callbacks with local migration responses', async () => {
  const onSuccess = vi.fn();
  const { result } = renderHook(
    () =>
      useCreateRemoteRelationshipMutation({ mutationOptions: { onSuccess } }),
    { wrapper },
  );
  const variables = { args: remoteArgs, resourceVersion: RESOURCE_VERSION };
  await result.current.mutateAsync(variables);
  expect(onSuccess).toHaveBeenCalledWith(
    { name: '0_test_metadata' },
    variables,
    undefined,
  );
});
