import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  CreateScheduledEventArgs,
  MetadataOperationResponse,
} from '@/utils/hasura-api/generated/schemas';
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
    MetadataOperationResponse,
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
export default function UseCreateOneOffMutationOptions({
  mutationOptions,
}: UseCreateOneOffMutationOptions = {}) {
  const { project } = useProject();
  // const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperationResponse,
    unknown,
    CreateOneOffMutationVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return createOneOff({
        args: variables.args,
        appUrl,
        adminSecret,
      });
    },
    {
      onSuccess: () => {
        // queryClient.invalidateQueries({
        //   queryKey: ['export-metadata', project?.subdomain],
        // });
        // TODO: Invalidate one-offs query here once implemented
      },
      ...mutationOptions,
    },
  );

  return mutation;
}
