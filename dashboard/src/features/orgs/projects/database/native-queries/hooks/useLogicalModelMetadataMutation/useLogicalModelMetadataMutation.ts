import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useGetSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import type {
  LogicalModelMutationType,
  LogicalModelMutationVariables,
} from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isEmptyValue } from '@/lib/utils';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import createLogicalModel from './createLogicalModel';
import createLogicalModelMigration from './createLogicalModelMigration';
import deleteLogicalModel from './deleteLogicalModel';
import deleteLogicalModelMigration from './deleteLogicalModelMigration';
import editLogicalModel from './editLogicalModel';
import editLogicalModelMigration from './editLogicalModelMigration';

export type LogicalModelMutationResponse =
  | SuccessResponse
  | MetadataOperation200;

export interface UseLogicalModelMetadataMutationOptions<
  T extends LogicalModelMutationType,
> {
  type: T;
  mutationOptions?: MutationOptions<
    LogicalModelMutationResponse,
    unknown,
    LogicalModelMutationVariables<T>
  >;
}

/**
 * Manages a logical model via Hasura's metadata API (platform mode) or the
 * migrations API (local mode), depending on the environment. The `type`
 * parameter selects the operation:
 *
 * - `add`    — tracks a new logical model.
 * - `edit`   — untracks the model by its original name and re-tracks it with
 *              the new definition, so the name itself can change. Untracking
 *              drops the model's select permissions, so both variants replay
 *              them under the new name.
 * - `delete` — untracks the model. The migration variant records a rollback
 *              that re-tracks it with its original definition and permissions.
 */
export default function useLogicalModelMetadataMutation<
  T extends LogicalModelMutationType,
>({ type, mutationOptions }: UseLogicalModelMetadataMutationOptions<T>) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const { data: supportedSources = [] } = useGetSupportedNativeQuerySources();
  const queryClient = useQueryClient();

  return useMutation<
    LogicalModelMutationResponse,
    unknown,
    LogicalModelMutationVariables<T>
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
            return createLogicalModel({
              ...base,
              appUrl,
              resourceVersion,
              source,
              args: (variables as LogicalModelMutationVariables<'add'>).args,
            });
          case 'edit': {
            const editVariables =
              variables as LogicalModelMutationVariables<'edit'>;
            return editLogicalModel({
              ...base,
              appUrl,
              resourceVersion,
              source,
              args: editVariables.args,
              original: editVariables.original,
            });
          }
          case 'delete':
            return deleteLogicalModel({
              ...base,
              appUrl,
              resourceVersion,
              source,
              original: (variables as LogicalModelMutationVariables<'delete'>)
                .original,
            });
          default:
            throw new Error(`Unsupported mutation type: ${type as string}`);
        }
      }

      switch (type) {
        case 'add':
          return createLogicalModelMigration({
            ...base,
            source,
            args: (variables as LogicalModelMutationVariables<'add'>).args,
          });
        case 'edit': {
          const editVariables =
            variables as LogicalModelMutationVariables<'edit'>;
          return editLogicalModelMigration({
            ...base,
            source,
            args: editVariables.args,
            original: editVariables.original,
          });
        }
        case 'delete':
          return deleteLogicalModelMigration({
            ...base,
            source,
            original: (variables as LogicalModelMutationVariables<'delete'>)
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
