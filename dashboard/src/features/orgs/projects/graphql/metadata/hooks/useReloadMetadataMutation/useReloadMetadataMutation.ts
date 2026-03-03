import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { ReloadMetadataOperationResponse } from '@/utils/hasura-api/generated/schemas';
import reloadMetadata, { type ReloadMetadataVariables } from './reloadMetadata';

/**
 * Props passed to the underlying mutation hook.
 */
export type UseReloadMetadataMutationOptions = MutationOptions<
  ReloadMetadataOperationResponse,
  unknown,
  ReloadMetadataVariables
>;

/**
 * This hook is a wrapper around a fetch call that reloads the metadata.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useReloadMetadataMutation(
  mutationOptions?: UseReloadMetadataMutationOptions,
) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return reloadMetadata({
        ...variables,
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        const [data] = args;

        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });

        if (data.is_consistent) {
          queryClient.setQueryData(
            ['inconsistent-metadata', project?.subdomain],
            { is_consistent: true, inconsistent_objects: [] },
          );
        } else {
          queryClient.invalidateQueries({
            queryKey: ['inconsistent-metadata', project?.subdomain],
          });
        }

        mutationOptions?.onSuccess?.(...args);
      },
    },
  );

  return mutation;
}
