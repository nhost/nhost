import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  MetadataOperationResponse,
  SuccessResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { RemoveRemoteSchemaVariables } from './removeRemoteSchema';
import removeRemoteSchema from './removeRemoteSchema';
import removeRemoteSchemaMigration, {
  type RemoveRemoteSchemaMigrationVariables,
} from './removeRemoteSchemaMigration';

export interface UseRemoveRemoteSchemaMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    RemoveRemoteSchemaVariables | RemoveRemoteSchemaMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that removes a remote schema.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useRemoveRemoteSchemaMutation({
  mutationOptions,
}: UseRemoveRemoteSchemaMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperationResponse,
    unknown,
    RemoveRemoteSchemaVariables | RemoveRemoteSchemaMigrationVariables
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
      return removeRemoteSchema({
        ...variables,
        ...base,
      });
    }

    return removeRemoteSchemaMigration({
      ...variables,
      ...base,
    });
  }, mutationOptions);

  return mutation;
}
