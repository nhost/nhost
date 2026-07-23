import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import createLogicalModel from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/createLogicalModel';
import createLogicalModelMigration from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/createLogicalModelMigration';
import deleteLogicalModel from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/deleteLogicalModel';
import deleteLogicalModelMigration from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/deleteLogicalModelMigration';
import editLogicalModel from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/editLogicalModel';
import editLogicalModelMigration from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/editLogicalModelMigration';
import type {
  LogicalModelMutationType,
  LogicalModelMutationVariables,
} from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  MetadataOperation200,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';

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

export default function useLogicalModelMetadataMutation<
  T extends LogicalModelMutationType,
>({ type, mutationOptions }: UseLogicalModelMetadataMutationOptions<T>) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const queryClient = useQueryClient();

  return useMutation<
    LogicalModelMutationResponse,
    unknown,
    LogicalModelMutationVariables<T>
  >(
    async (variables) => {
      if (!project?.config?.hasura.adminSecret) {
        throw new Error('Project metadata connection is unavailable.');
      }

      const base = {
        appUrl: generateAppServiceUrl(
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

        switch (type) {
          case 'add':
            return createLogicalModel({
              ...base,
              resourceVersion,
              args: (variables as LogicalModelMutationVariables<'add'>).args,
            });
          case 'edit': {
            const editVariables =
              variables as LogicalModelMutationVariables<'edit'>;
            return editLogicalModel({
              ...base,
              resourceVersion,
              ...editVariables,
            });
          }
          case 'delete':
            return deleteLogicalModel({
              ...base,
              resourceVersion,
              original: (
                variables as LogicalModelMutationVariables<'delete'>
              ).original,
            });
          default:
            throw new Error(`Unsupported mutation type: ${type as string}`);
        }
      }

      switch (type) {
        case 'add':
          return createLogicalModelMigration({
            ...base,
            args: (variables as LogicalModelMutationVariables<'add'>).args,
          });
        case 'edit':
          return editLogicalModelMigration({
            ...base,
            ...(variables as LogicalModelMutationVariables<'edit'>),
          });
        case 'delete':
          return deleteLogicalModelMigration({
            ...base,
            original: (variables as LogicalModelMutationVariables<'delete'>)
              .original,
          });
        default:
          throw new Error(`Unsupported mutation type: ${type as string}`);
      }
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
