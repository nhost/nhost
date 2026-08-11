import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type { UpdateTableOptions, UpdateTableVariables } from './updateTable';
import updateTable from './updateTable';
import updateTableMigration from './updateTableMigration';

export interface UseUpdateTableMutationOptions
  extends Partial<UpdateTableOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<void, unknown, UpdateTableVariables>;
}

/**
 * This hook is a wrapper around a fetch call that updates a table in the
 * database.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useUpdateTableMutation({
  dataSource: customDataSource,
  schema: customSchema,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseUpdateTableMutationOptions = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug, schemaSlug },
  } = useRouter();
  const adminApi = useAdminApiTarget();

  const mutationFn = isPlatform ? updateTable : updateTableMigration;

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
