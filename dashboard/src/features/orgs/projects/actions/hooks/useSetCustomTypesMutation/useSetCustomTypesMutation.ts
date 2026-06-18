import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SetCustomTypesVariables } from './setCustomTypes';
import setCustomTypes from './setCustomTypes';

export interface UseSetCustomTypesMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    SetCustomTypesVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that replaces the full set of
 * custom types in the metadata.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useSetCustomTypesMutation({
  mutationOptions,
}: UseSetCustomTypesMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    SetCustomTypesVariables
  >(
    (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return setCustomTypes({
        customTypes: variables.customTypes,
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
