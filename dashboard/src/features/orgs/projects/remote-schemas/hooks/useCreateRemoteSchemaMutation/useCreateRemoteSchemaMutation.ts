import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { HasuraError } from '@/utils/hasura-api/types';
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
  const adminApi = useAdminApiTarget();

  const mutation = useMutation((variables) => {
    const appUrl = adminApi!.appUrl;

    return createRemoteSchema({
      ...variables,
      appUrl,
      adminSecret: adminApi!.adminSecret,
    });
  }, mutationOptions);

  return mutation;
}
