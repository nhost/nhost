import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type { RemoveRemoteSchemaPermissionsVariables } from './removeRemoteSchemaPermissions';
import removeRemoteSchemaPermissions from './removeRemoteSchemaPermissions';

export interface UseRemoveRemoteSchemaPermissionsMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse,
    unknown,
    RemoveRemoteSchemaPermissionsVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that removes a remote schema permission.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useRemoveRemoteSchemaPermissionsMutation({
  mutationOptions,
}: UseRemoveRemoteSchemaPermissionsMutationOptions = {}) {
  const { project } = useProject();

  const appUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'hasura',
  );
  const mutationFn = removeRemoteSchemaPermissions;

  const mutation = useMutation(
    (variables) =>
      mutationFn({
        ...variables,
        appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : project?.config?.hasura.adminSecret,
      }),
    mutationOptions,
  );

  return mutation;
}
