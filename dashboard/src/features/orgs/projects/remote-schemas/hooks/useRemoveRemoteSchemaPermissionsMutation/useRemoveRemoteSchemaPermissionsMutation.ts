import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { RemoveRemoteSchemaPermissionsVariables } from './removeRemoteSchemaPermissions';
import removeRemoteSchemaPermissions from './removeRemoteSchemaPermissions';
import type { RemoveRemoteSchemaPermissionsMigrationVariables } from './removeRemoteSchemaPermissionsMigration';
import removeRemoteSchemaPermissionsMigration from './removeRemoteSchemaPermissionsMigration';

export interface UseRemoveRemoteSchemaPermissionsMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    | RemoveRemoteSchemaPermissionsVariables
    | RemoveRemoteSchemaPermissionsMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that removes a remote schema permissions.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useRemoveRemoteSchemaPermissionsMutation({
  mutationOptions,
}: UseRemoveRemoteSchemaPermissionsMutationOptions = {}) {
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    | RemoveRemoteSchemaPermissionsVariables
    | RemoveRemoteSchemaPermissionsMigrationVariables
  >((variables) => {
    const base = {
      adminSecret: adminApi!.adminSecret,
    } as const;

    if (isPlatform) {
      return removeRemoteSchemaPermissions({
        ...(variables as RemoveRemoteSchemaPermissionsVariables),
        appUrl: adminApi!.appUrl,
        ...base,
      });
    }

    return removeRemoteSchemaPermissionsMigration({
      ...(variables as RemoveRemoteSchemaPermissionsMigrationVariables),
      ...base,
    });
  }, mutationOptions);

  return mutation;
}
