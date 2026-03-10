import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SetFunctionCustomizationVariables } from './setFunctionCustomization';
import setFunctionCustomization from './setFunctionCustomization';

export interface UseSetFunctionCustomizationMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    SetFunctionCustomizationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that sets a function customization.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useSetFunctionCustomizationMutation({
  mutationOptions,
}: UseSetFunctionCustomizationMutationOptions = {}) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    SetFunctionCustomizationVariables
  >({
    mutationFn: (variables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const base = {
        appUrl,
        adminSecret: project!.config!.hasura.adminSecret,
      } as const;

      return setFunctionCustomization({
        ...(variables as SetFunctionCustomizationVariables),
        ...base,
      });
    },
    ...mutationOptions,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      });

      mutationOptions?.onSuccess?.(data, variables, context);
    },
  });

  return mutation;
}
