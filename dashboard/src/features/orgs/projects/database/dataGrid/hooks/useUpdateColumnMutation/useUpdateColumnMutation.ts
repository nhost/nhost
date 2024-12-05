import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
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

  const { project } = useProject();

  const appUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'hasura',
  );
  const mutationFn = isPlatform ? updateColumn : updateColumnMigration;

  const mutation = useMutation(
    (variables) =>
      mutationFn({
        ...variables,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || project?.config?.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
        table: customTable || (tableSlug as string),
      }),
    mutationOptions,
  );

  return mutation;
}
