import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { SetActionRelationshipsVariables } from './setActionRelationships';
import setActionRelationships from './setActionRelationships';
import setActionRelationshipsMigration from './setActionRelationshipsMigration';

export interface UseSetActionRelationshipsMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    SetActionRelationshipsVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that replaces the custom types in
 * order to add, edit or remove relationships on an action's output type.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useSetActionRelationshipsMutation({
  mutationOptions,
}: UseSetActionRelationshipsMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    SetActionRelationshipsVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      if (isPlatform) {
        return setActionRelationships({
          ...variables,
          appUrl,
          adminSecret,
        });
      }

      return setActionRelationshipsMigration({
        ...variables,
        appUrl,
        adminSecret,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
      },
      ...mutationOptions,
    },
  );

  return mutation;
}
