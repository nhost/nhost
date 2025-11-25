import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
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

  const mutation = useMutation((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    return renameRelationship({
      ...(variables as RenameRelationshipVariables),
      appUrl,
      adminSecret: project?.config?.hasura.adminSecret!,
    });
  }, mutationOptions);

  return mutation;
}
