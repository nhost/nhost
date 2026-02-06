import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  MetadataOperationResponse,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { AddRemoteSchemaPermissionsVariables } from './addRemoteSchemaPermissions';
import addRemoteSchemaPermissions from './addRemoteSchemaPermissions';
import type { AddRemoteSchemaPermissionsMigrationVariables } from './addRemoteSchemaPermissionsMigration';
import addRemoteSchemaPermissionsMigration from './addRemoteSchemaPermissionsMigration';

export interface UseAddRemoteSchemaPermissionsMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    | AddRemoteSchemaPermissionsVariables
    | AddRemoteSchemaPermissionsMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that adds a remote schema permission.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useAddRemoteSchemaPermissionsMutation({
  mutationOptions,
}: UseAddRemoteSchemaPermissionsMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    | AddRemoteSchemaPermissionsVariables
    | AddRemoteSchemaPermissionsMigrationVariables
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
      return addRemoteSchemaPermissions({
        ...(variables as AddRemoteSchemaPermissionsVariables),
        ...base,
      });
    }

    return addRemoteSchemaPermissionsMigration({
      ...(variables as AddRemoteSchemaPermissionsMigrationVariables),
      ...base,
    });
  }, mutationOptions);

  return mutation;
}
