import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
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

  const mutation = useMutation<
    MetadataOperation200,
    unknown,
    SetFunctionCustomizationVariables
  >((variables) => {
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
  }, mutationOptions);

  return mutation;
}
