import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import createRemoteSchemaRelationship, {
  type CreateRemoteSchemaRelationshipVariables,
} from './createRemoteSchemaRelationship';

export interface UseCreateRemoteSchemaRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    CreateRemoteSchemaRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that creates a remote schema relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateRemoteSchemaRelationshipMutation({
  mutationOptions,
}: UseCreateRemoteSchemaRelationshipMutationOptions = {}) {
  const adminApi = useAdminApiTarget();

  const mutation = useMutation((variables) => {
    const appUrl = adminApi!.appUrl;

    return createRemoteSchemaRelationship({
      ...variables,
      appUrl,
      adminSecret: adminApi!.adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
