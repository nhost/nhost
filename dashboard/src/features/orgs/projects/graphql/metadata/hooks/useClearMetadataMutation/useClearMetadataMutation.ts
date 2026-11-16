import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas';
import clearMetadata from './clearMetadata';

export type UseClearMetadataMutationOptions = MutationOptions<
  MetadataOperation200,
  unknown
>;

export default function useClearMetadataMutation(
  mutationOptions?: UseClearMetadataMutationOptions,
) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    () => {
      const appUrl = adminApi!.appUrl;

      return clearMetadata({
        appUrl,
        adminSecret: adminApi!.adminSecret,
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
