import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import type {
  NativeQueryMutationType,
  NativeQueryMutationVariables,
} from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation/types';
import {
  buildCreateNativeQueryMigration,
  buildDeleteNativeQueryMigration,
  buildEditNativeQueryMigration,
  buildEditNativeQuerySteps,
  buildTrackNativeQueryStep,
  buildUntrackNativeQueryStep,
  type NativeQueryMigration,
} from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
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

export type NativeQueryMutationResponse = SuccessResponse | MetadataOperation200;

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

export default function useNativeQueryMetadataMutation<
  T extends NativeQueryMutationType,
>({ type, mutationOptions }: UseNativeQueryMetadataMutationOptions<T>) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const queryClient = useQueryClient();

  return useMutation<
    NativeQueryMutationResponse,
    unknown,
    NativeQueryMutationVariables<T>
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
            buildTrackNativeQueryStep(
              (variables as NativeQueryMutationVariables<'add'>).args,
            ),
          ];
        } else if (type === 'edit') {
          const editVariables = variables as NativeQueryMutationVariables<'edit'>;
          args = buildEditNativeQuerySteps(
            editVariables.args,
            editVariables.original,
          );
        } else {
          args = [
            buildUntrackNativeQueryStep(
              (variables as NativeQueryMutationVariables<'delete'>).original
                .root_field_name,
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

      let migration: NativeQueryMigration;
      if (type === 'add') {
        migration = buildCreateNativeQueryMigration(
          (variables as NativeQueryMutationVariables<'add'>).args,
        );
      } else if (type === 'edit') {
        const editVariables = variables as NativeQueryMutationVariables<'edit'>;
        migration = buildEditNativeQueryMigration(
          editVariables.args,
          editVariables.original,
        );
      } else {
        migration = buildDeleteNativeQueryMigration(
          (variables as NativeQueryMutationVariables<'delete'>).original,
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
