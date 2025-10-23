import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { HasuraError } from '@/utils/hasura-api/types';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import {
  deleteEventTrigger,
  type DeleteEventTriggerVariables,
} from './deleteEventTrigger';

export interface UseDeleteEventTriggerMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    HasuraError,
    DeleteEventTriggerVariables
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

  const mutation = useMutation((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    return deleteEventTrigger({
      appUrl,
      adminSecret: project?.config?.hasura.adminSecret!,
      args: variables.args,
    });
  }, mutationOptions);

  return mutation;
}
