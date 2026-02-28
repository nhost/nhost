import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import deleteRelationship, {
  type DeleteRelationshipVariables,
} from './deleteRelationship';

export interface UseDeleteRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    DeleteRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes a relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteRelationshipMutation({
  mutationOptions,
}: UseDeleteRelationshipMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return deleteRelationship({
        ...variables,
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        queryClient.invalidateQueries({
          queryKey: ['suggest-relationships', variables.args.source],
        });
      },
    },
  );

  return mutation;
}
