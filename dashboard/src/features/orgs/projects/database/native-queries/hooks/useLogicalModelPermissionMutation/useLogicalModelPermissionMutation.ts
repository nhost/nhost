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
import { executeMetadataMutation } from '@/features/orgs/projects/database/native-queries/utils/execute-metadata-mutation';
import {
  buildCreateLogicalModelPermissionStep,
  buildDropLogicalModelPermissionStep,
  buildEditLogicalModelPermissionSteps,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionOperations';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  MetadataOperation200,
  NativeQueryMetadataBulkOperation,
} from '@/utils/hasura-api/generated/schemas';

export type LogicalModelPermissionMutationResponse = MetadataOperation200;

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

      const { data: resourceVersion, error: resourceVersionError } =
        await refetchResourceVersion();
      if (resourceVersionError) {
        throw resourceVersionError;
      }
      if (resourceVersion === undefined) {
        throw new Error('Could not load the latest metadata version.');
      }

      let args: NativeQueryMetadataBulkOperation['args'];
      switch (type) {
        case 'add':
          args = [
            buildCreateLogicalModelPermissionStep(
              (variables as LogicalModelPermissionMutationVariables<'add'>)
                .args,
            ),
          ];
          break;
        case 'edit':
          args = buildEditLogicalModelPermissionSteps(
            (variables as LogicalModelPermissionMutationVariables<'edit'>).args,
          );
          break;
        case 'delete': {
          const deleteVariables =
            variables as LogicalModelPermissionMutationVariables<'delete'>;
          args = [
            buildDropLogicalModelPermissionStep(
              deleteVariables.name,
              deleteVariables.role,
            ),
          ];
          break;
        }
        default:
          throw new Error(`Unsupported mutation type: ${type as string}`);
      }

      const subdomain = project.subdomain;

      return executeMetadataMutation(
        { type: 'bulk', resource_version: resourceVersion, args },
        {
          appUrl: generateAppServiceUrl(
            project.subdomain,
            project.region,
            'hasura',
          ),
          adminSecret: project.config.hasura.adminSecret,
          isPlatform,
          onPartialSuccess: () =>
            queryClient.invalidateQueries(
              {
                queryKey: [EXPORT_METADATA_QUERY_KEY, subdomain],
                refetchType: 'all',
              },
              { throwOnError: true },
            ),
        },
      );
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
