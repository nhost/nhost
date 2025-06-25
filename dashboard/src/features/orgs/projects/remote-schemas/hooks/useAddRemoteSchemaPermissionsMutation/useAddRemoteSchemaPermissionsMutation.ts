import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type { AddRemoteSchemaPermissionsVariables } from './addRemoteSchemaPermissions';
import addRemoteSchemaPermissions from './addRemoteSchemaPermissions';

export interface UseAddRemoteSchemaPermissionsMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse,
    unknown,
    AddRemoteSchemaPermissionsVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that adds a remote schema permission.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useAddRemoteSchemaPermissionsMutation({
  mutationOptions,
}: UseAddRemoteSchemaPermissionsMutationOptions = {}) {
  const { project } = useProject();

  const appUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'hasura',
  );
  const mutationFn = addRemoteSchemaPermissions;

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
