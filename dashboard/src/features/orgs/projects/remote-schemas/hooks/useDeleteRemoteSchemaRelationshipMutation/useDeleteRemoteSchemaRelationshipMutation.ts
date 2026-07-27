import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { DeleteRemoteSchemaRelationshipVariables } from './deleteRemoteSchemaRelationship';
import deleteRemoteSchemaRelationship from './deleteRemoteSchemaRelationship';

export interface UseDeleteRemoteSchemaRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    DeleteRemoteSchemaRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes a remote schema relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteRemoteSchemaRelationshipMutation({
  mutationOptions,
}: UseDeleteRemoteSchemaRelationshipMutationOptions = {}) {
  const hasuraApi = useHasuraApiTarget();

  const mutation = useMutation((variables) => {
    const appUrl = hasuraApi!.appUrl;

    return deleteRemoteSchemaRelationship({
      ...variables,
      appUrl,
      adminSecret: hasuraApi!.adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
