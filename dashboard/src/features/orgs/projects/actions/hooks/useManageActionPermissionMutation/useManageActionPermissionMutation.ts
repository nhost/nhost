import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { ManageActionPermissionVariables } from './manageActionPermission';
import manageActionPermission from './manageActionPermission';
import manageActionPermissionMigration from './manageActionPermissionMigration';

export interface UseManageActionPermissionMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    ManageActionPermissionVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that grants or removes a role's
 * permission to call an action.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useManageActionPermissionMutation({
  mutationOptions,
}: UseManageActionPermissionMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    ManageActionPermissionVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      if (isPlatform) {
        return manageActionPermission({
          ...variables,
          appUrl,
          adminSecret,
        });
      }

      return manageActionPermissionMigration({
        ...variables,
        appUrl,
        adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        mutationOptions?.onSuccess?.(...args);
      },
    },
  );

  return mutation;
}
