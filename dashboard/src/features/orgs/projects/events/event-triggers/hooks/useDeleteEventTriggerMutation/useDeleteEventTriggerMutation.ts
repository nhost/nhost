import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  MetadataOperationResponse,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';
import { deleteEventTrigger } from './deleteEventTrigger';
import { deleteEventTriggerMigration } from './deleteEventTriggerMigration';

export interface DeleteEventTriggerMutationVariables {
  /**
   * The original event trigger to delete.
   */
  originalEventTrigger: EventTriggerViewModel;
  /**
   * The resource version of the metadata.
   */
  resourceVersion?: number;
}

export interface UseDeleteEventTriggerMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    DeleteEventTriggerMutationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes an event trigger.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteEventTriggerMutation({
  mutationOptions,
}: UseDeleteEventTriggerMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    DeleteEventTriggerMutationVariables
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
        return deleteEventTrigger({
          args: {
            name: variables.originalEventTrigger.name,
            source: variables.originalEventTrigger.dataSource,
          },
          resourceVersion: variables.resourceVersion,
          ...base,
        });
      }

      return deleteEventTriggerMigration({
        originalEventTrigger: variables.originalEventTrigger,
        ...base,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['export-metadata', project?.subdomain],
        });
      },
      ...mutationOptions,
    },
  );

  return mutation;
}
