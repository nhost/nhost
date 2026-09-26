import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import deleteCronTrigger from './deleteCronTrigger';
import deleteCronTriggerMigration from './deleteCronTriggerMigration';

export interface DeleteCronTriggerMutationVariables {
  /**
   * Arguments to delete a cron trigger.
   */
  cronTriggerName: string;
}

export interface UseDeleteCronTriggerMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200 | SuccessResponse,
    unknown,
    DeleteCronTriggerMutationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes a cron trigger.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteCronTriggerMutation({
  mutationOptions,
}: UseDeleteCronTriggerMutationOptions = {}) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200 | SuccessResponse,
    unknown,
    DeleteCronTriggerMutationVariables
  >(
    (variables) => {
      const appUrl = adminApi!.appUrl;

      const adminSecret = adminApi!.adminSecret;

      const mutationFn = isPlatform
        ? deleteCronTrigger
        : deleteCronTriggerMigration;
      return mutationFn({
        args: {
          name: variables.cronTriggerName,
        },
        appUrl,
        adminSecret,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        queryClient.invalidateQueries({
          queryKey: ['get-cron-triggers', project?.subdomain],
        });
      },
      ...mutationOptions,
    },
  );

  return mutation;
}
