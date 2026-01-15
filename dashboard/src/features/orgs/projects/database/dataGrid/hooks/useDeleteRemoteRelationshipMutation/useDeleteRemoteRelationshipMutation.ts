import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import deleteRemoteRelationship, {
  type DeleteRemoteRelationshipVariables,
} from './deleteRemoteRelationship';

export interface UseDeleteRemoteRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    DeleteRemoteRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that drops a relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteRemoteRelationshipMutation({
  mutationOptions,
}: UseDeleteRemoteRelationshipMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return deleteRemoteRelationship({
        ...variables,
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      });
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

  return mutation;
}
