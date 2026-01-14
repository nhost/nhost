import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { deleteScheduledEvent } from '@/features/orgs/projects/events/common/api/deleteScheduledEvent';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface DeleteScheduledCronTriggerEventMutationVariables {
  /**
   * The ID of the scheduled event to delete.
   */
  eventId: string;
}

export interface UseDeleteScheduledCronTriggerEventMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    DeleteScheduledCronTriggerEventMutationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes a scheduled cron trigger event.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteScheduledCronTriggerEventMutation({
  mutationOptions,
}: UseDeleteScheduledCronTriggerEventMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    DeleteScheduledCronTriggerEventMutationVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return deleteScheduledEvent({
        args: {
          type: 'cron',
          event_id: variables.eventId,
        },
        appUrl,
        adminSecret,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['get-cron-event-logs'],
        });
      },
      ...mutationOptions,
    },
  );

  return mutation;
}
