import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  InconsistentMetadataResponse,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { ReplaceMetadataVariables } from './replaceMetadata';
import replaceMetadata from './replaceMetadata';
import replaceMetadataMigration, {
  type ReplaceMetadataMigrationVariables,
} from './replaceMetadataMigration';

export type UseReplaceMetadataMutationOptions = MutationOptions<
  InconsistentMetadataResponse | SuccessResponse,
  unknown,
  ReplaceMetadataVariables | ReplaceMetadataMigrationVariables
>;

export default function useReplaceMetadataMutation(
  mutationOptions?: UseReplaceMetadataMutationOptions,
) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    InconsistentMetadataResponse | SuccessResponse,
    unknown,
    ReplaceMetadataVariables | ReplaceMetadataMigrationVariables
  >(
    (variables) => {
      const base = {
        adminSecret: adminApi!.adminSecret,
      } as const;

      if (isPlatform) {
        return replaceMetadata({
          ...(variables as ReplaceMetadataVariables),
          appUrl: adminApi!.appUrl,
          ...base,
        });
      }

      return replaceMetadataMigration({
        ...(variables as ReplaceMetadataMigrationVariables),
        ...base,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        const [data] = args;

        if (isPlatform) {
          queryClient.setQueryData(
            ['inconsistent-metadata', project?.subdomain],
            { ...data },
          );
        }
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        mutationOptions?.onSuccess?.(...args);
      },
    },
  );

  return mutation;
}
