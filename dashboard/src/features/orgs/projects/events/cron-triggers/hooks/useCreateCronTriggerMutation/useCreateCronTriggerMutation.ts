import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  CreateCronTriggerArgs,
  MetadataOperationResponse,
} from '@/utils/hasura-api/generated/schemas';
import createCronTrigger from './createCronTrigger';

export interface CreateCronTriggerMutationVariables {
  /**
   * Arguments to create a cron trigger.
   */
  args: CreateCronTriggerArgs;
}

export interface UseCreateCronTriggerMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperationResponse,
    unknown,
    CreateCronTriggerMutationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that creates a cron trigger.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateCronTriggerMutation({
  mutationOptions,
}: UseCreateCronTriggerMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperationResponse,
    unknown,
    CreateCronTriggerMutationVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return createCronTrigger({
        args: variables.args,
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
