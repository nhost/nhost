import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { HasuraError } from '@/utils/hasura-api/types';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type { CreateRemoteSchemaVariables } from './createRemoteSchema';
import createRemoteSchema from './createRemoteSchema';

export interface UseCreateRemoteSchemaMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    HasuraError,
    CreateRemoteSchemaVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that creates a remote schema.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateRemoteSchemaMutation({
  mutationOptions,
}: UseCreateRemoteSchemaMutationOptions = {}) {
  const { project } = useProject();

  const mutation = useMutation((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    return createRemoteSchema({
      ...variables,
      appUrl,
      adminSecret: project?.config?.hasura.adminSecret!,
    });
  }, mutationOptions);

  return mutation;
}
