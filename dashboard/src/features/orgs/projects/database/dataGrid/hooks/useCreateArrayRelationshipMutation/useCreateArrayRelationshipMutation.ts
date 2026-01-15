import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import createArrayRelationship, {
  type CreateArrayRelationshipVariables,
} from './createArrayRelationship';

export interface UseCreateArrayRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    CreateArrayRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that creates an array relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateArrayRelationshipMutation({
  mutationOptions,
}: UseCreateArrayRelationshipMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return createArrayRelationship({
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
