import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type { ReloadRemoteSchemaVariables } from './reloadRemoteSchema';
import reloadRemoteSchema from './reloadRemoteSchema';

export interface UseReloadRemoteSchemaMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    ReloadRemoteSchemaVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that reloads a remote schema.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useReloadRemoteSchemaMutation({
  mutationOptions,
}: UseReloadRemoteSchemaMutationOptions = {}) {
  const { project } = useProject();

  const mutation = useMutation((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    return reloadRemoteSchema({
      ...variables,
      appUrl,
      adminSecret: project!.config!.hasura.adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
