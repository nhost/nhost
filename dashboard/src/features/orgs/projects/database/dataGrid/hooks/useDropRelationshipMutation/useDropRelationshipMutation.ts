import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import dropRelationship, {
  type DropRelationshipVariables,
} from './dropRelationship';

export interface UseDropRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    DropRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that drops a relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDropRelationshipMutation({
  mutationOptions,
}: UseDropRelationshipMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return dropRelationship({
        ...variables,
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: ['export-metadata', project?.subdomain],
        });
        queryClient.invalidateQueries({
          queryKey: ['suggest-relationships', variables.args.source],
        });
      },
    },
  );

  return mutation;
}
