import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { RemoveRemoteSchemaVariables } from './removeRemoteSchema';
import removeRemoteSchema from './removeRemoteSchema';
import removeRemoteSchemaMigration, {
  type RemoveRemoteSchemaMigrationVariables,
} from './removeRemoteSchemaMigration';

export interface UseRemoveRemoteSchemaMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    RemoveRemoteSchemaVariables | RemoveRemoteSchemaMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that removes a remote schema.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useRemoveRemoteSchemaMutation({
  mutationOptions,
}: UseRemoveRemoteSchemaMutationOptions = {}) {
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    RemoveRemoteSchemaVariables | RemoveRemoteSchemaMigrationVariables
  >((variables) => {
    const base = {
      adminSecret: adminApi!.adminSecret,
    } as const;

    if (isPlatform) {
      return removeRemoteSchema({
        ...variables,
        appUrl: adminApi!.appUrl,
        ...base,
      });
    }

    return removeRemoteSchemaMigration({
      ...variables,
      ...base,
    });
  }, mutationOptions);

  return mutation;
}
