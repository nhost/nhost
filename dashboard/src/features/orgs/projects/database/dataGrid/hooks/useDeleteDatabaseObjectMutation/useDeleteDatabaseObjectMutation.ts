import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type {
  DeleteDatabaseObjectOptions,
  DeleteDatabaseObjectVariables,
} from './deleteDatabaseObject';
import deleteDatabaseObject from './deleteDatabaseObject';
import deleteDatabaseObjectMigration from './deleteDatabaseObjectMigration';

export interface UseDeleteDatabaseObjectMutationOptions
  extends Partial<DeleteDatabaseObjectOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    void,
    unknown,
    DeleteDatabaseObjectVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes a database object
 * from the schema.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteDatabaseObjectMutation({
  dataSource: customDataSource,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseDeleteDatabaseObjectMutationOptions = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const { project } = useProject();
  const mutationFn = isPlatform
    ? deleteDatabaseObject
    : deleteDatabaseObjectMigration;

  const mutation = useMutation((variables) => {
    const appUrl = generateAppServiceUrl(
      project!.subdomain,
      project!.region,
      'hasura',
    );
    return mutationFn({
      ...variables,
      appUrl: customAppUrl || appUrl,
      adminSecret:
        process.env.NEXT_PUBLIC_ENV === 'dev'
          ? getHasuraAdminSecret()
          : customAdminSecret || project!.config!.hasura.adminSecret,
      dataSource: customDataSource || (dataSourceSlug as string),
    });
  }, mutationOptions);

  return mutation;
}
