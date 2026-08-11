import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import type { InvokeEventTriggerResponse } from '@/utils/hasura-api/generated/schemas/invokeEventTriggerResponse';
import invokeEventTrigger, {
  type InvokeEventTriggerVariables,
} from './invokeEventTrigger';

export interface UseInvokeEventTriggerMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    InvokeEventTriggerResponse,
    unknown,
    InvokeEventTriggerVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that invokes an event trigger.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useInvokeEventTriggerMutation({
  mutationOptions,
}: UseInvokeEventTriggerMutationOptions = {}) {
  const adminApi = useAdminApiTarget();

  const mutation = useMutation<
    InvokeEventTriggerResponse,
    unknown,
    InvokeEventTriggerVariables
  >((variables) => {
    const appUrl = adminApi!.appUrl;

    const adminSecret = adminApi!.adminSecret;

    return invokeEventTrigger({
      args: variables.args,
      appUrl,
      adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
