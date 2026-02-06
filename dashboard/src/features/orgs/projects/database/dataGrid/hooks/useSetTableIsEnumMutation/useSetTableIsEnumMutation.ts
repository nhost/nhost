import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  MetadataOperationResponse,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { SetTableIsEnumVariables } from './setTableIsEnum';
import setTableIsEnum from './setTableIsEnum';
import type { SetTableIsEnumMigrationVariables } from './setTableIsEnumMigration';
import setTableIsEnumMigration from './setTableIsEnumMigration';

export interface UseSetTableIsEnumMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    SetTableIsEnumVariables | SetTableIsEnumMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that sets a table as enum.
 *
 * @param mutationOptions - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useSetTableIsEnumMutation({
  mutationOptions,
}: UseSetTableIsEnumMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    SetTableIsEnumVariables | SetTableIsEnumMigrationVariables
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
      return setTableIsEnum({
        ...(variables as SetTableIsEnumVariables),
        ...base,
      });
    }

    return setTableIsEnumMigration({
      ...(variables as SetTableIsEnumMigrationVariables),
      ...base,
    });
  }, mutationOptions);

  return mutation;
}
