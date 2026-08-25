import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import createRelationship, {
  type CreateRelationshipVariables,
} from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRelationshipMutation/createRelationship';
import { getSuggestRelationshipsQueryKey } from '@/features/orgs/projects/database/dataGrid/hooks/useSuggestRelationshipsQuery';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';

export interface UseCreateRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    CreateRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that creates a relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateRelationshipMutation({
  mutationOptions,
}: UseCreateRelationshipMutationOptions = {}) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const queryClient = useQueryClient();

  return useMutation(
    (variables) => {
      if (!adminApi) {
        throw new Error('Admin API is not available.');
      }

      return createRelationship({
        ...variables,
        appUrl: adminApi.appUrl,
        adminSecret: adminApi.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: async (...args) => {
        const [, variables] = args;

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: getSuggestRelationshipsQueryKey(
              project?.subdomain,
              variables.args.source,
            ),
            exact: true,
          }),
        ]);
        await mutationOptions?.onSuccess?.(...args);
      },
    },
  );
}
