import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { ManageFunctionPermissionVariables } from './manageFunctionPermission';
import manageFunctionPermission from './manageFunctionPermission';
import type { ManageFunctionPermissionMigrationVariables } from './manageFunctionPermissionMigration';
import manageFunctionPermissionMigration from './manageFunctionPermissionMigration';

export interface UseManagePermissionMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    | ManageFunctionPermissionVariables
    | ManageFunctionPermissionMigrationVariables
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
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    | ManageFunctionPermissionVariables
    | ManageFunctionPermissionMigrationVariables
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

      if (isPlatform) {
        return manageFunctionPermission({
          ...(variables as ManageFunctionPermissionVariables),
          ...base,
        });
      }

      return manageFunctionPermissionMigration({
        ...(variables as ManageFunctionPermissionMigrationVariables),
        ...base,
      });
    },
    {
      ...mutationOptions,
      onSuccess: async (data, variables, context) => {
        await queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });

        mutationOptions?.onSuccess?.(data, variables, context);
      },
    },
  );

  return mutation;
}
