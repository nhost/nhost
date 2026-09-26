import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  CreateCronTriggerArgs,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import createCronTrigger from './createCronTrigger';
import createCronTriggerMigration from './createCronTriggerMigration';

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
    MetadataOperation200 | SuccessResponse,
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
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200 | SuccessResponse,
    unknown,
    CreateCronTriggerMutationVariables
  >(
    (variables) => {
      const appUrl = adminApi!.appUrl;

      const adminSecret = adminApi!.adminSecret;

      const mutationFn = isPlatform
        ? createCronTrigger
        : createCronTriggerMigration;
      return mutationFn({
        args: variables.args,
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
