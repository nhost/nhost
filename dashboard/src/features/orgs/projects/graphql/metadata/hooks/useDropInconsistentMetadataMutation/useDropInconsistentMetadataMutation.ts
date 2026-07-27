import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useHasuraApiTarget } from '@/features/orgs/projects/common/hooks/useHasuraApiTarget';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas';
import dropInconsistentMetadata from './dropInconsistentMetadata';

export type UseDropInconsistentMetadataMutationOptions = MutationOptions<
  MetadataOperation200,
  unknown
>;

/**
 * This hook is a wrapper around a fetch call that drops the inconsistent metadata.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDropInconsistentMetadataMutation(
  mutationOptions?: UseDropInconsistentMetadataMutationOptions,
) {
  const { project } = useProject();
  const hasuraApi = useHasuraApiTarget();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    () => {
      const appUrl = hasuraApi!.appUrl;

      return dropInconsistentMetadata({
        appUrl,
        adminSecret: hasuraApi!.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        queryClient.invalidateQueries({
          queryKey: ['inconsistent-metadata', project?.subdomain],
        });
        mutationOptions?.onSuccess?.(...args);
      },
    },
  );

  return mutation;
}
