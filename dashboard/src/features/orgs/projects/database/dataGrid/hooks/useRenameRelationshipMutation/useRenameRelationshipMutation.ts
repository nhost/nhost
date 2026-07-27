import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import renameRelationship, {
  type RenameRelationshipVariables,
} from './renameRelationship';

export interface UseRenameRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    RenameRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that renames a relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useRenameRelationshipMutation({
  mutationOptions,
}: UseRenameRelationshipMutationOptions = {}) {
  const { project } = useProject();
  const hasuraApi = useHasuraApiTarget();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (variables) => {
      const appUrl = hasuraApi!.appUrl;

      return renameRelationship({
        ...variables,
        appUrl,
        adminSecret: hasuraApi!.adminSecret,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
      },
      ...mutationOptions,
    },
  );

  return mutation;
}
