import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { DeleteRemoteSchemaRelationshipVariables } from './deleteRemoteSchemaRelationship';
import deleteRemoteSchemaRelationship from './deleteRemoteSchemaRelationship';
import deleteRemoteSchemaRelationshipMigration from './deleteRemoteSchemaRelationshipMigration';

export interface UseDeleteRemoteSchemaRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200 | SuccessResponse,
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
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();

  const mutation = useMutation((variables) => {
    const appUrl = adminApi!.appUrl;

    const mutationFn = isPlatform
      ? deleteRemoteSchemaRelationship
      : deleteRemoteSchemaRelationshipMigration;
    return mutationFn({
      ...variables,
      appUrl,
      adminSecret: adminApi!.adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
