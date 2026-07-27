import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import createRelationship, {
  type CreateRelationshipVariables,
} from './createRelationship';

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
  const hasuraApi = useHasuraApiTarget();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (variables) => {
      const appUrl = hasuraApi!.appUrl;

      return createRelationship({
        ...variables,
        appUrl,
        adminSecret: hasuraApi!.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        const [, variables] = args;

        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        queryClient.invalidateQueries({
          queryKey: ['suggest-relationships', variables.args.source],
        });
        mutationOptions?.onSuccess?.(...args);
      },
    },
  );

  return mutation;
}
