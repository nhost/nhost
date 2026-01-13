import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import deleteCronTrigger from './deleteCronTrigger';

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
    MetadataOperation200,
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
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    DeleteCronTriggerMutationVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project?.config?.hasura.adminSecret!;

      return deleteCronTrigger({
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
          queryKey: ['export-metadata', project?.subdomain],
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
