import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import { buildTrackingOperation } from '@/features/orgs/projects/database/dataGrid/utils/buildTrackingOperation';

export interface UseDatabaseObjectTrackingMutationVariables {
  tracked: boolean;
  resourceVersion: number;
  source?: string;
  schema: string;
  name: string;
  isFunction?: boolean;
}

export type UseDatabaseObjectTrackingMutationOptions = MutationOptions<
  SuccessResponse | MetadataOperation200,
  unknown,
  UseDatabaseObjectTrackingMutationVariables
>;

export default function useDatabaseObjectTrackingMutation(
  mutationOptions?: UseDatabaseObjectTrackingMutationOptions,
) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  return useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    UseDatabaseObjectTrackingMutationVariables
  >({
    mutationFn: async ({
      tracked,
      resourceVersion,
      source,
      schema,
      name,
      isFunction,
    }) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      const adminSecret = project!.config!.hasura.adminSecret;

      const operation = buildTrackingOperation({
        isFunction: isFunction ?? false,
        tracked,
        resourceVersion,
        source: source ?? 'default',
        schema,
        name,
      });

      const response = await metadataOperation(operation, {
        baseUrl: appUrl,
        adminSecret,
      });

      if (response.status === 200) {
        return response.data;
      }

      throw new Error(response.data.error);
    },
    ...mutationOptions,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      });
      mutationOptions?.onSuccess?.(...args);
    },
  });
}
