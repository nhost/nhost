import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import type { SetTableCustomizationVariables } from './setTableCustomization';
import setTableCustomization from './setTableCustomization';
import type { SetTableCustomizationMigrationVariables } from './setTableCustomizationMigration';
import setTableCustomizationMigration from './setTableCustomizationMigration';

export interface UseSetTableCustomizationMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    SetTableCustomizationVariables | SetTableCustomizationMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that sets a table customization.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useSetTableCustomizationMutation({
  mutationOptions,
}: UseSetTableCustomizationMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    SetTableCustomizationVariables | SetTableCustomizationMigrationVariables
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

    if (isPlatform) {
      return setTableCustomization({
        ...(variables as SetTableCustomizationVariables),
        ...base,
      });
    }

    return setTableCustomizationMigration({
      ...(variables as SetTableCustomizationMigrationVariables),
      ...base,
    });
  }, mutationOptions);

  return mutation;
}
