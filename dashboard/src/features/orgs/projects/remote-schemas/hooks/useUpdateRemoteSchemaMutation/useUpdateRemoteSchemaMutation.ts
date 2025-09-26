import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type { UpdateRemoteSchemaVariables } from './updateRemoteSchema';
import updateRemoteSchema from './updateRemoteSchema';
import type { UpdateRemoteSchemaMigrationVariables } from './updateRemoteSchemaMigration';
import updateRemoteSchemaMigration from './updateRemoteSchemaMigration';

export interface UseUpdateRemoteSchemaMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    SuccessResponse | MetadataOperation200,
    unknown,
    UpdateRemoteSchemaVariables | UpdateRemoteSchemaMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that updates a remote schema.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useUpdateRemoteSchemaMutation({
  mutationOptions,
}: UseUpdateRemoteSchemaMutationOptions = {}) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const mutation = useMutation<
    SuccessResponse | MetadataOperation200,
    unknown,
    UpdateRemoteSchemaVariables | UpdateRemoteSchemaMigrationVariables
  >((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    const base = {
      appUrl,
      adminSecret: project?.config?.hasura.adminSecret!,
    } as const;

    if (isPlatform) {
      return updateRemoteSchema({
        ...(variables as UpdateRemoteSchemaVariables),
        ...base,
      });
    }

    return updateRemoteSchemaMigration({
      ...(variables as UpdateRemoteSchemaMigrationVariables),
      ...base,
    });
  }, mutationOptions);

  return mutation;
}
