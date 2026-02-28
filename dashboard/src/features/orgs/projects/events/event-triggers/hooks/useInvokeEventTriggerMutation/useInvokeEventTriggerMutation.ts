import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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
  const { project } = useProject();

  const mutation = useMutation<
    InvokeEventTriggerResponse,
    unknown,
    InvokeEventTriggerVariables
  >((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    const adminSecret = project!.config!.hasura.adminSecret;

    return invokeEventTrigger({
      args: variables.args,
      appUrl,
      adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
