import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
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
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    | RemoveRemoteSchemaPermissionsVariables
    | RemoveRemoteSchemaPermissionsMigrationVariables
  >((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    const base = {
      appUrl,
      adminSecret: project!.config!.hasura.adminSecret,
    } as const;

    if (isPlatform) {
      return removeRemoteSchemaPermissions({
        ...(variables as RemoveRemoteSchemaPermissionsVariables),
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
