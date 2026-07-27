import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import redeliverEvent, { type RedeliverEventVariables } from './redeliverEvent';

export interface UseRedeliverEventMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
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
  const hasuraApi = useHasuraApiTarget();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    RedeliverEventVariables
  >((variables) => {
    const appUrl = hasuraApi!.appUrl;

    const adminSecret = hasuraApi!.adminSecret;

    return redeliverEvent({
      args: variables.args,
      appUrl,
      adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
