import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import type {
  UpdateColumnOptions,
  UpdateColumnVariables,
} from './updateColumn';
import updateColumn from './updateColumn';
import updateColumnMigration from './updateColumnMigration';

export interface UseUpdateColumnMutationOptions
  extends Partial<UpdateColumnOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<void, unknown, UpdateColumnVariables>;
}

/**
 * This hook is a wrapper around a fetch call that updates a column in the
 * table.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useUpdateColumnMutation({
  dataSource: customDataSource,
  schema: customSchema,
  table: customTable,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseUpdateColumnMutationOptions = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
  } = useRouter();

  const adminApi = useAdminApiTarget();

  const mutationFn = isPlatform ? updateColumn : updateColumnMigration;

  const mutation = useMutation((variables) => {
    const appUrl = adminApi!.appUrl;
    return mutationFn({
      ...variables,
      appUrl: customAppUrl || appUrl,
      adminSecret: customAdminSecret || adminApi!.adminSecret,
      dataSource: customDataSource || (dataSourceSlug as string),
      schema: customSchema || (schemaSlug as string),
      table: customTable || (tableSlug as string),
    });
  }, mutationOptions);

  return mutation;
}
