import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
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
  const queryClient = useQueryClient();

  const mutation = useMutation(
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return clearMetadata({
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        queryClient.invalidateQueries({
          queryKey: ['inconsistent-metadata', project?.subdomain],
        });
      },
    },
  );

  return mutation;
}
