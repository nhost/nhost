import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { TrackTableVariables } from './trackTable';
import trackTable from './trackTable';
import type { TrackTableMigrationVariables } from './trackTableMigration';
import trackTableMigration from './trackTableMigration';

/**
 * Props passed to the underlying mutation hook.
 */
export type UseTrackTableMutationOptions = MutationOptions<
  SuccessResponse | MetadataOperation200,
  unknown,
  TrackTableVariables | TrackTableMigrationVariables
>;

/**
 * This hook is a wrapper around a fetch call that tracks a table.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useTrackTableMutation(
  mutationOptions?: UseTrackTableMutationOptions,
) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    TrackTableVariables | TrackTableMigrationVariables
  >((variables) => {
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
      return trackTable({
        ...(variables as TrackTableVariables),
        ...base,
      });
    }

    return trackTableMigration({
      ...(variables as TrackTableMigrationVariables),
      ...base,
    });
  }, {
    ...mutationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['export-metadata', project?.subdomain],
      });
    },
  });

  return mutation;
}
