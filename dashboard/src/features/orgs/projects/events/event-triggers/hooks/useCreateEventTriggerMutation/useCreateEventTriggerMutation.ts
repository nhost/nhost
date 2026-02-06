import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  CreateEventTriggerArgs,
  MetadataOperationResponse,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';
import createEventTrigger from './createEventTrigger';
import createEventTriggerMigration from './createEventTriggerMigration';

export interface CreateEventTriggerMutationVariables {
  /**
   * Arguments to create an event trigger.
   */
  args: CreateEventTriggerArgs;
  /**
   * The resource version for (platform mode only).
   */
  resourceVersion?: number;
}

export interface UseCreateEventTriggerMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    CreateEventTriggerMutationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that creates an event trigger.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateEventTriggerMutation({
  mutationOptions,
}: UseCreateEventTriggerMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    CreateEventTriggerMutationVariables
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
        return createEventTrigger({
          args: variables.args,
          resourceVersion: variables.resourceVersion,
          ...base,
        });
      }

      return createEventTriggerMigration({
        args: variables.args,
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
