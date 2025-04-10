import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import type {
  CreateRemoteSchemaOptions,
  CreateRemoteSchemaVariables,
} from './createRemoteSchema';
import createRemoteSchema from './createRemoteSchema';

export interface UseCreateRemoteSchemaMutationOptions
  extends Partial<CreateRemoteSchemaOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<void, unknown, CreateRemoteSchemaVariables>;
}

/**
 * This hook is a wrapper around a fetch call that creates a remote schema.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateRemoteSchemaMutation({
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseCreateRemoteSchemaMutationOptions = {}) {
  // const isPlatform = useIsPlatform();
  const { project } = useProject();
  const appUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'hasura',
  );

  //const mutationFn = isPlatform ? managePermission : managePermissionMigration;
  const mutationFn = createRemoteSchema;

  const mutation = useMutation(
    (variables) =>
      mutationFn({
        ...variables,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project?.config?.hasura.adminSecret,
      }),
    mutationOptions,
  );

  return mutation;
}
