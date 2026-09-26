import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import updateRemoteSchemaRelationship, {
  type UpdateRemoteSchemaRelationshipVariables,
} from './updateRemoteSchemaRelationship';
import updateRemoteSchemaRelationshipMigration from './updateRemoteSchemaRelationshipMigration';

export interface UseUpdateRemoteSchemaRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200 | SuccessResponse,
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
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();

  const mutation = useMutation((variables) => {
    const appUrl = adminApi!.appUrl;

    const mutationFn = isPlatform
      ? updateRemoteSchemaRelationship
      : updateRemoteSchemaRelationshipMigration;
    return mutationFn({
      ...variables,
      appUrl,
      adminSecret: adminApi!.adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
