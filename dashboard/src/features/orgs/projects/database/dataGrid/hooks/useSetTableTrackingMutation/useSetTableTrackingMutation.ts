import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { TrackTableArgs } from '@/utils/hasura-api/generated/schemas/trackTableArgs';
import setTableTracking from './setTableTracking';
import setTableTrackingMigration from './setTableTrackingMigration';

export interface UseSetTableTrackingMutationVariables {
  tracked: boolean;
  resourceVersion: number | undefined;
  args: TrackTableArgs;
}

export type UseSetTableTrackingMutationOptions = MutationOptions<
  SuccessResponse | MetadataOperation200,
  unknown,
  UseSetTableTrackingMutationVariables
>;

export default function useSetTableTrackingMutation(
  mutationOptions?: UseSetTableTrackingMutationOptions,
) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  return useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    UseSetTableTrackingMutationVariables
  >(
    ({ tracked, resourceVersion, args }) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      const base = {
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      } as const;

      if (isPlatform) {
        return setTableTracking({
          tracked,
          resourceVersion: resourceVersion!,
          args,
          ...base,
        });
      }
      return setTableTrackingMigration({ tracked, args, ...base });
    },
    {
      ...mutationOptions,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['export-metadata', project?.subdomain],
        });
      },
    },
  );
}
