import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import deleteOneOff from './deleteOneOff';

export interface DeleteOneOffMutationVariables {
  /**
   * The ID of the one-off scheduled event to delete.
   */
  eventId: string;
}

export interface UseDeleteOneOffMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    DeleteOneOffMutationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes a one-off scheduled event.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteOneOffMutation({
  mutationOptions,
}: UseDeleteOneOffMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    DeleteOneOffMutationVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return deleteOneOff({
        args: {
          type: 'one_off',
          event_id: variables.eventId,
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
