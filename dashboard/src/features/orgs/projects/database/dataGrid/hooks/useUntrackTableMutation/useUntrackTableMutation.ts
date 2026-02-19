import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { UntrackTableVariables } from './untrackTable';
import untrackTable from './untrackTable';
import type { UntrackTableMigrationVariables } from './untrackTableMigration';
import untrackTableMigration from './untrackTableMigration';

/**
 * Props passed to the underlying mutation hook.
 */
export type UseUntrackTableMutationOptions = MutationOptions<
  SuccessResponse | MetadataOperation200,
  unknown,
  UntrackTableVariables | UntrackTableMigrationVariables
>;

export default function useUntrackTableMutation(
  mutationOptions?: UseUntrackTableMutationOptions,
) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    UntrackTableVariables | UntrackTableMigrationVariables
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
      return untrackTable({
        ...(variables as UntrackTableVariables),
        ...base,
      });
    }

    return untrackTableMigration({
      ...(variables as UntrackTableMigrationVariables),
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
