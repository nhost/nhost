import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import redeliverEvent, { type RedeliverEventVariables } from './redeliverEvent';

export interface UseAddRemoteSchemaPermissionsMutationOptions {
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
}: UseAddRemoteSchemaPermissionsMutationOptions = {}) {
  const { project } = useProject();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    RedeliverEventVariables
  >((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    const adminSecret = project?.config?.hasura.adminSecret!;

    return redeliverEvent({
      args: variables.args,
      appUrl,
      adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
