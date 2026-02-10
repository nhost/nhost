import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas';
import dropInconsistentMetadata from './dropInconsistentMetadata';

export interface UseDropInconsistentMetadataMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<SuccessResponse, unknown>;
}

/**
 * This hook is a wrapper around a fetch call that drops the inconsistent metadata.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDropInconsistentMetadataMutation({
  mutationOptions,
}: UseDropInconsistentMetadataMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return dropInconsistentMetadata({
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['inconsistent-metadata', project?.subdomain],
        });
      },
    },
  );

  return mutation;
}
