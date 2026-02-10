import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { InconsistentMetadataResponse } from '@/utils/hasura-api/generated/schemas';
import type { ReplaceMetadataVariables } from './replaceMetadata';
import replaceMetadata from './replaceMetadata';

export interface UseReplaceMetadataMutationOptions {
  mutationOptions?: MutationOptions<
    InconsistentMetadataResponse,
    unknown,
    ReplaceMetadataVariables
  >;
}

export default function useReplaceMetadataMutation({
  mutationOptions,
}: UseReplaceMetadataMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (input: ReplaceMetadataVariables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return replaceMetadata({
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
        metadata: input.metadata,
        allowInconsistentMetadata: input.allowInconsistentMetadata,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (data) => {
        queryClient.setQueryData(
          ['inconsistent-metadata', project?.subdomain],
          { ...data },
        );
        queryClient.invalidateQueries({
          queryKey: ['export-metadata', project?.subdomain],
        });
      },
    },
  );

  return mutation;
}
