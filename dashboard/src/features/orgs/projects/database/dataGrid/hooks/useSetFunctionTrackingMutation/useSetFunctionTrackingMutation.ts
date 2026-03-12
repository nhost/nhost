import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { TrackFunctionArgs } from '@/utils/hasura-api/generated/schemas/trackFunctionArgs';
import setFunctionTracking from './setFunctionTracking';
import setFunctionTrackingMigration from './setFunctionTrackingMigration';

export interface UseSetFunctionTrackingMutationVariables {
  tracked: boolean;
  resourceVersion: number | undefined;
  args: TrackFunctionArgs;
}

export type UseSetFunctionTrackingMutationOptions = MutationOptions<
  SuccessResponse | MetadataOperation200,
  unknown,
  UseSetFunctionTrackingMutationVariables
>;

export default function useSetFunctionTrackingMutation(
  mutationOptions?: UseSetFunctionTrackingMutationOptions,
) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  return useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    UseSetFunctionTrackingMutationVariables
  >({
    mutationFn: ({ tracked, resourceVersion, args }) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      const commonParams = {
        tracked,
        args,
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      } as const;

      if (isPlatform) {
        return setFunctionTracking({
          resourceVersion: resourceVersion!,
          ...commonParams,
        });
      }
      return setFunctionTrackingMigration(commonParams);
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
