import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { UpdateRemoteSchemaPermissionsVariables } from './updateRemoteSchemaPermissions';
import updateRemoteSchemaPermissions from './updateRemoteSchemaPermissions';
import type { UpdateRemoteSchemaPermissionsMigrationVariables } from './updateRemoteSchemaPermissionsMigration';
import updateRemoteSchemaPermissionsMigration from './updateRemoteSchemaPermissionsMigration';

export interface UseUpdateRemoteSchemaPermissionsMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    | UpdateRemoteSchemaPermissionsVariables
    | UpdateRemoteSchemaPermissionsMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that updates remote schema permissions.
 * It can update permissions for a specific role on a remote schema.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useUpdateRemoteSchemaPermissionsMutation({
  mutationOptions,
}: UseUpdateRemoteSchemaPermissionsMutationOptions = {}) {
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    | UpdateRemoteSchemaPermissionsVariables
    | UpdateRemoteSchemaPermissionsMigrationVariables
  >((variables) => {
    const base = {
      adminSecret: adminApi!.adminSecret,
    } as const;

    if (isPlatform) {
      return updateRemoteSchemaPermissions({
        ...(variables as UpdateRemoteSchemaPermissionsVariables),
        appUrl: adminApi!.appUrl,
        ...base,
      });
    }

    return updateRemoteSchemaPermissionsMigration({
      ...(variables as UpdateRemoteSchemaPermissionsMigrationVariables),
      ...base,
    });
  }, mutationOptions);

  return mutation;
}
