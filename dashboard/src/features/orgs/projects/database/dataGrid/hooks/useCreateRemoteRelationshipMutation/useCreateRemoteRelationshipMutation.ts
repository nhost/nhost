import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import createRemoteRelationship, {
  type CreateRemoteRelationshipVariables,
} from './createRemoteRelationship';
import createRemoteRelationshipMigration from './createRemoteRelationshipMigration';

export interface UseCreateRemoteRelationshipMutationOptions {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    MetadataOperation200 | SuccessResponse,
    unknown,
    CreateRemoteRelationshipVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that creates a remote relationship.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateRemoteRelationshipMutation({
  mutationOptions,
}: UseCreateRemoteRelationshipMutationOptions = {}) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    (variables) => {
      const appUrl = adminApi!.appUrl;

      const mutationFn = isPlatform
        ? createRemoteRelationship
        : createRemoteRelationshipMigration;
      return mutationFn({
        ...variables,
        appUrl,
        adminSecret: adminApi!.adminSecret,
      });
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        const [, variables] = args;

        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        queryClient.invalidateQueries({
          queryKey: [
            'suggest-relationships',
            variables.args.source ?? 'default',
          ],
        });
        mutationOptions?.onSuccess?.(...args);
      },
    },
  );

  return mutation;
}
