import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useGetSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import type {
  NativeQueryMutationType,
  NativeQueryMutationVariables,
} from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isEmptyValue } from '@/lib/utils';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import createNativeQuery from './createNativeQuery';
import createNativeQueryMigration from './createNativeQueryMigration';
import deleteNativeQuery from './deleteNativeQuery';
import deleteNativeQueryMigration from './deleteNativeQueryMigration';
import editNativeQuery from './editNativeQuery';
import editNativeQueryMigration from './editNativeQueryMigration';

export type NativeQueryMutationResponse =
  | SuccessResponse
  | MetadataOperation200;

interface UseNativeQueryMetadataMutationOptions<
  T extends NativeQueryMutationType,
> {
  type: T;
  mutationOptions?: MutationOptions<
    NativeQueryMutationResponse,
    unknown,
    NativeQueryMutationVariables<T>
  >;
}

/**
 * Manages a native query via Hasura's metadata API (platform mode) or the
 * migrations API (local mode), depending on the environment. The `type`
 * parameter selects the operation:
 *
 * - `add`    — tracks a new native query.
 * - `edit`   — untracks the query by its original root field name and
 *              re-tracks it with the new definition, so the name itself can
 *              change.
 * - `delete` — untracks the query. The migration variant records a rollback
 *              that re-tracks it with its original definition.
 */
export default function useNativeQueryMetadataMutation<
  T extends NativeQueryMutationType,
>({ type, mutationOptions }: UseNativeQueryMetadataMutationOptions<T>) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const { data: supportedSources = [] } = useGetSupportedNativeQuerySources();
  const queryClient = useQueryClient();

  return useMutation<
    NativeQueryMutationResponse,
    unknown,
    NativeQueryMutationVariables<T>
  >(
    async (variables) => {
      if (!adminApi) {
        throw new Error('Project metadata connection is unavailable.');
      }

      const { source } = variables;
      if (isEmptyValue(source)) {
        throw new Error('A data source is required.');
      }
      if (!supportedSources.includes(source)) {
        throw new Error('The selected data source is unavailable.');
      }

      const base = { adminSecret: adminApi.adminSecret } as const;

      const { data: resourceVersion, error: resourceVersionError } =
        await refetchResourceVersion();
      if (resourceVersionError) {
        throw resourceVersionError;
      }
      if (resourceVersion === undefined) {
        throw new Error('Could not load the latest metadata version.');
      }

      if (isPlatform) {
        const { appUrl } = adminApi;

        switch (type) {
          case 'add':
            return createNativeQuery({
              ...base,
              appUrl,
              resourceVersion,
              source,
              args: (variables as NativeQueryMutationVariables<'add'>).args,
            });
          case 'edit': {
            const editVariables =
              variables as NativeQueryMutationVariables<'edit'>;
            return editNativeQuery({
              ...base,
              appUrl,
              resourceVersion,
              source,
              args: editVariables.args,
              original: editVariables.original,
            });
          }
          case 'delete':
            return deleteNativeQuery({
              ...base,
              appUrl,
              resourceVersion,
              source,
              original: (variables as NativeQueryMutationVariables<'delete'>)
                .original,
            });
          default:
            throw new Error(`Unsupported mutation type: ${type as string}`);
        }
      }

      switch (type) {
        case 'add':
          return createNativeQueryMigration({
            ...base,
            source,
            args: (variables as NativeQueryMutationVariables<'add'>).args,
          });
        case 'edit': {
          const editVariables =
            variables as NativeQueryMutationVariables<'edit'>;
          return editNativeQueryMigration({
            ...base,
            source,
            args: editVariables.args,
            original: editVariables.original,
          });
        }
        case 'delete':
          return deleteNativeQueryMigration({
            ...base,
            source,
            original: (variables as NativeQueryMutationVariables<'delete'>)
              .original,
          });
        default:
          throw new Error(`Unsupported mutation type: ${type as string}`);
      }
    },
    {
      ...mutationOptions,
      onSuccess: async (...args) => {
        await queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        await mutationOptions?.onSuccess?.(...args);
      },
    },
  );
}
