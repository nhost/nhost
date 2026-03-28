import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { SetTableIsEnumVariables } from './setTableIsEnum';
import setTableIsEnum from './setTableIsEnum';
import type { SetTableIsEnumMigrationVariables } from './setTableIsEnumMigration';
import setTableIsEnumMigration from './setTableIsEnumMigration';

export interface UseSetTableIsEnumMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    SetTableIsEnumVariables | SetTableIsEnumMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that sets a table as enum.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useSetTableIsEnumMutation({
  mutationOptions,
}: UseSetTableIsEnumMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    SetTableIsEnumVariables | SetTableIsEnumMigrationVariables
  >({
    mutationFn: (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const commonParams = {
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      } as const;

      if (isPlatform) {
        return setTableIsEnum({
          ...(variables as SetTableIsEnumVariables),
          ...commonParams,
        });
      }

      return setTableIsEnumMigration({
        ...(variables as SetTableIsEnumMigrationVariables),
        ...commonParams,
      });
    },
    ...mutationOptions,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      });
      mutationOptions?.onSuccess?.(...args);
    },
  });

  return mutation;
}
