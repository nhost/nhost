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
import { executeMetadataMutation } from '@/features/orgs/projects/database/native-queries/utils/execute-metadata-mutation';
import {
  buildEditNativeQuerySteps,
  buildTrackNativeQueryStep,
  buildUntrackNativeQueryStep,
} from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  MetadataOperation200,
  NativeQueryMetadataBulkOperation,
} from '@/utils/hasura-api/generated/schemas';

export type NativeQueryMutationResponse = MetadataOperation200;

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

      const { data: resourceVersion } = await refetchResourceVersion();
      if (resourceVersion === undefined) {
        throw new Error('Could not load the latest metadata version.');
      }

      let args: NativeQueryMetadataBulkOperation['args'];
      switch (type) {
        case 'add':
          args = [
            buildTrackNativeQueryStep(
              (variables as NativeQueryMutationVariables<'add'>).args,
            ),
          ];
          break;
        case 'edit': {
          const editVariables =
            variables as NativeQueryMutationVariables<'edit'>;
          args = buildEditNativeQuerySteps(
            editVariables.args,
            editVariables.original,
          );
          break;
        }
        case 'delete':
          args = [
            buildUntrackNativeQueryStep(
              (variables as NativeQueryMutationVariables<'delete'>).original
                .root_field_name,
            ),
          ];
          break;
        default:
          throw new Error(`Unsupported mutation type: ${type as string}`);
      }

      const subdomain = project.subdomain;

      return executeMetadataMutation(
        { type: 'bulk_atomic', resource_version: resourceVersion, args },
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
