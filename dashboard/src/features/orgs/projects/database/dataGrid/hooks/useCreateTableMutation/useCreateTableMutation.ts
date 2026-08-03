import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { CreateTableOptions, CreateTableVariables } from './createTable';
import createTable from './createTable';
import createTableMigration from './createTableMigration';

export interface UseCreateTableMutationOptions
  extends Partial<CreateTableOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<void, unknown, CreateTableVariables>;
}

/**
 * This hook is a wrapper around a fetch call that creates a table in the
 * specified schema.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateTableMutation({
  dataSource: customDataSource,
  schema: customSchema,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseCreateTableMutationOptions = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug, schemaSlug },
  } = useRouter();

  const adminApi = useAdminApiTarget();

  const mutationFn = isPlatform ? createTable : createTableMigration;

  const mutation = useMutation((variables) => {
    const appUrl = adminApi!.appUrl;

    return mutationFn({
      ...variables,
      appUrl: customAppUrl || appUrl,
      adminSecret: customAdminSecret || adminApi!.adminSecret,
      dataSource: customDataSource || (dataSourceSlug as string),
      schema: customSchema || (schemaSlug as string),
    });
  }, mutationOptions);

  return mutation;
}
