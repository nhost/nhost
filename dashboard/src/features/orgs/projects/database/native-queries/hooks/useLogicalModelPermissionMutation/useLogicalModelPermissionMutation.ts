import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useGetSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import type {
  LogicalModelPermissionMutationType,
  LogicalModelPermissionMutationVariables,
} from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isEmptyValue } from '@/lib/utils';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import createLogicalModelPermission from './createLogicalModelPermission';
import createLogicalModelPermissionMigration from './createLogicalModelPermissionMigration';
import deleteLogicalModelPermission from './deleteLogicalModelPermission';
import deleteLogicalModelPermissionMigration from './deleteLogicalModelPermissionMigration';
import editLogicalModelPermission from './editLogicalModelPermission';
import editLogicalModelPermissionMigration from './editLogicalModelPermissionMigration';

export type LogicalModelPermissionMutationResponse =
  | SuccessResponse
  | MetadataOperation200;

interface UseLogicalModelPermissionMutationOptions<
  T extends LogicalModelPermissionMutationType,
> {
  type: T;
  mutationOptions?: MutationOptions<
    LogicalModelPermissionMutationResponse,
    unknown,
    LogicalModelPermissionMutationVariables<T>
  >;
}

/**
 * Manages a logical model select permission via Hasura's metadata API
 * (platform mode) or the migrations API (local mode), depending on the
 * environment. The `type` parameter selects the operation:
 *
 * - `add`    — creates a permission for a role.
 * - `edit`   — drops the role's permission and re-creates it from `args`. The
 *              migration variant records a rollback that restores `original`.
 * - `delete` — drops the role's permission. The migration variant records a
 *              rollback that re-creates `original`.
 */
export default function useLogicalModelPermissionMutation<
  T extends LogicalModelPermissionMutationType,
>({ type, mutationOptions }: UseLogicalModelPermissionMutationOptions<T>) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const { data: supportedSources = [] } = useGetSupportedNativeQuerySources();
  const queryClient = useQueryClient();

  return useMutation<
    LogicalModelPermissionMutationResponse,
    unknown,
    LogicalModelPermissionMutationVariables<T>
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

      const base = { adminSecret: adminApi.adminSecret, source } as const;

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
            return createLogicalModelPermission({
              ...base,
              appUrl,
              resourceVersion,
              args: (
                variables as LogicalModelPermissionMutationVariables<'add'>
              ).args,
            });
          case 'edit':
            return editLogicalModelPermission({
              ...base,
              appUrl,
              resourceVersion,
              args: (
                variables as LogicalModelPermissionMutationVariables<'edit'>
              ).args,
            });
          case 'delete': {
            const deleteVariables =
              variables as LogicalModelPermissionMutationVariables<'delete'>;
            return deleteLogicalModelPermission({
              ...base,
              appUrl,
              resourceVersion,
              name: deleteVariables.name,
              role: deleteVariables.role,
            });
          }
          default:
            throw new Error(`Unsupported mutation type: ${type as string}`);
        }
      }

      switch (type) {
        case 'add':
          return createLogicalModelPermissionMigration({
            ...base,
            args: (variables as LogicalModelPermissionMutationVariables<'add'>)
              .args,
          });
        case 'edit': {
          const editVariables =
            variables as LogicalModelPermissionMutationVariables<'edit'>;
          return editLogicalModelPermissionMigration({
            ...base,
            args: editVariables.args,
            original: editVariables.original,
          });
        }
        case 'delete': {
          const deleteVariables =
            variables as LogicalModelPermissionMutationVariables<'delete'>;
          return deleteLogicalModelPermissionMigration({
            ...base,
            name: deleteVariables.name,
            role: deleteVariables.role,
            original: deleteVariables.original,
            originalComment: deleteVariables.originalComment,
          });
        }
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
