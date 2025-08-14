import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type { UpdateRemoteSchemaVariables } from './updateRemoteSchema';
import updateRemoteSchema from './updateRemoteSchema';

export interface UseUpdateRemoteSchemaMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200,
    unknown,
    UpdateRemoteSchemaVariables
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

  const mutation = useMutation((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );

    return updateRemoteSchema({
      ...variables,
      appUrl,
      adminSecret:
        process.env.NEXT_PUBLIC_ENV === 'dev'
          ? getHasuraAdminSecret()
          : project?.config?.hasura.adminSecret!,
    });
  }, mutationOptions);

  return mutation;
}
