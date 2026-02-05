import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { deleteScheduledEvent } from '@/features/orgs/projects/events/common/api/deleteScheduledEvent';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { DeleteScheduledEventArgsType } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';

export interface DeleteScheduledEventMutationVariables {
  /**
   * The type of the scheduled event to delete.
   */
  type: DeleteScheduledEventArgsType;
  /**
   * The ID of the scheduled event to delete.
   */
  eventId: string;
}

export interface UseDeleteScheduledEventMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    DeleteScheduledEventMutationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes a scheduled event.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteScheduledEventMutation({
  mutationOptions,
}: UseDeleteScheduledEventMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    DeleteScheduledEventMutationVariables
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
          type: variables.type,
          event_id: variables.eventId,
        },
        appUrl,
        adminSecret,
      });
    },
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: ['get-scheduled-event-logs', variables.type],
        });
      },
      ...mutationOptions,
    },
  );

  return mutation;
}
