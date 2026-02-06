import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperationResponse } from '@/utils/hasura-api/generated/schemas';
import redeliverEvent, { type RedeliverEventVariables } from './redeliverEvent';

export interface UseRedeliverEventMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperationResponse,
    unknown,
    RedeliverEventVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that redelivers an event.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useRedeliverEventMutation({
  mutationOptions,
}: UseRedeliverEventMutationOptions = {}) {
  const { project } = useProject();

  const mutation = useMutation<
    MetadataOperationResponse,
    unknown,
    RedeliverEventVariables
  >((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    const adminSecret = project!.config!.hasura.adminSecret;

    return redeliverEvent({
      args: variables.args,
      appUrl,
      adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
