import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import updateRemoteSchemaRelationship, {
  type UpdateRemoteSchemaRelationshipVariables,
} from './updateRemoteSchemaRelationship';

export interface UseUpdateRemoteSchemaRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    UpdateRemoteSchemaRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that updates a remote schema relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useUpdateRemoteSchemaRelationshipMutation({
  mutationOptions,
}: UseUpdateRemoteSchemaRelationshipMutationOptions = {}) {
  const hasuraApi = useHasuraApiTarget();

  const mutation = useMutation((variables) => {
    const appUrl = hasuraApi!.appUrl;

    return updateRemoteSchemaRelationship({
      ...variables,
      appUrl,
      adminSecret: hasuraApi!.adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
