import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import type {
  LogicalModelPermissionMutationType,
  LogicalModelPermissionMutationVariables,
} from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import {
  buildCreateLogicalModelPermissionMigration,
  buildCreateLogicalModelPermissionStep,
  buildDeleteLogicalModelPermissionMigration,
  buildDropLogicalModelPermissionStep,
  buildEditLogicalModelPermissionMigration,
  buildEditLogicalModelPermissionSteps,
  type LogicalModelPermissionMigration,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionOperations';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  executeMigration,
  metadataOperation,
} from '@/utils/hasura-api/generated/default/default';
import type {
  MetadataOperation200,
  NativeQueryMetadataBulkOperation,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';

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

export default function useLogicalModelPermissionMutation<
  T extends LogicalModelPermissionMutationType,
>({ type, mutationOptions }: UseLogicalModelPermissionMutationOptions<T>) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const queryClient = useQueryClient();

  return useMutation<
    LogicalModelPermissionMutationResponse,
    unknown,
    LogicalModelPermissionMutationVariables<T>
  >(
    async (variables) => {
      if (!project?.config?.hasura.adminSecret) {
        throw new Error('Project metadata connection is unavailable.');
      }

      const requestOptions = {
        baseUrl: generateAppServiceUrl(
          project.subdomain,
          project.region,
          'hasura',
        ),
        adminSecret: project.config.hasura.adminSecret,
      };

      if (isPlatform) {
        const { data: resourceVersion } = await refetchResourceVersion();
        if (resourceVersion === undefined) {
          throw new Error('Could not load the latest metadata version.');
        }

        let args: NativeQueryMetadataBulkOperation['args'];
        if (type === 'add') {
          args = [
            buildCreateLogicalModelPermissionStep(
              (
                variables as LogicalModelPermissionMutationVariables<'add'>
              ).args,
            ),
          ];
        } else if (type === 'edit') {
          args = buildEditLogicalModelPermissionSteps(
            (
              variables as LogicalModelPermissionMutationVariables<'edit'>
            ).args,
          );
        } else {
          const deleteVariables =
            variables as LogicalModelPermissionMutationVariables<'delete'>;
          args = [
            buildDropLogicalModelPermissionStep(
              deleteVariables.name,
              deleteVariables.role,
            ),
          ];
        }

        const response = await metadataOperation(
          { type: 'bulk_atomic', resource_version: resourceVersion, args },
          requestOptions,
        );
        if (response.status === 200) {
          return response.data;
        }
        throw new Error(response.data.error);
      }

      let migration: LogicalModelPermissionMigration;
      if (type === 'add') {
        migration = buildCreateLogicalModelPermissionMigration(
          (variables as LogicalModelPermissionMutationVariables<'add'>).args,
        );
      } else if (type === 'edit') {
        const editVariables =
          variables as LogicalModelPermissionMutationVariables<'edit'>;
        migration = buildEditLogicalModelPermissionMigration(
          editVariables.args,
          editVariables.original,
        );
      } else {
        const deleteVariables =
          variables as LogicalModelPermissionMutationVariables<'delete'>;
        migration = buildDeleteLogicalModelPermissionMigration(
          deleteVariables.name,
          deleteVariables.role,
          deleteVariables.original,
        );
      }

      const response = await executeMigration(migration, requestOptions);
      if (response.status === 200) {
        return response.data;
      }
      throw new Error(response.data.error);
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        mutationOptions?.onSuccess?.(...args);
      },
    },
  );
}
