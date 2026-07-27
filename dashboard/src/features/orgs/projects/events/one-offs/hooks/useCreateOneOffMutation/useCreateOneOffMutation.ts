import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { CreateScheduledEventArgs } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import createOneOff from './createOneOff';

export interface CreateOneOffMutationVariables {
  /**
   * Arguments to create a one off scheduled event.
   */
  args: CreateScheduledEventArgs;
}

export interface UseCreateOneOffMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    CreateOneOffMutationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that creates a one off scheduled event.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateOneOffMutation({
  mutationOptions,
}: UseCreateOneOffMutationOptions = {}) {
  const { project } = useProject();
  const hasuraApi = useHasuraApiTarget();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    CreateOneOffMutationVariables
  >(
    (variables) => {
      const appUrl = hasuraApi!.appUrl;

      const adminSecret = hasuraApi!.adminSecret;

      return createOneOff({
        args: variables.args,
        appUrl,
        adminSecret,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['get-scheduled-event-logs', project?.subdomain, 'one_off'],
        });
      },
      ...mutationOptions,
    },
  );

  return mutation;
}
