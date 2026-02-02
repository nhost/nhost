import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { ManageFunctionPermissionVariables } from './manageFunctionPermission';
import manageFunctionPermission from './manageFunctionPermission';

export interface UseManagePermissionMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    ManageFunctionPermissionVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that manages function permissions.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useManageFunctionPermissionMutation({
  mutationOptions,
}: UseManagePermissionMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    ManageFunctionPermissionVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const base = {
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      } as const;

      return manageFunctionPermission({
        ...variables,
        ...base,
      });
    },
    {
      ...mutationOptions,
      onSuccess: async (data, variables, context) => {
        // Refetch metadata query - useFunctionPermissionQuery derives from this
        await queryClient.refetchQueries({ queryKey: [`default.metadata`] });

        // Call the original onSuccess if provided
        mutationOptions?.onSuccess?.(data, variables, context);
      },
    },
  );

  return mutation;
}
