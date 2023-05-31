import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
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

  const { currentProject } = useCurrentWorkspaceAndProject();
  const appUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'hasura',
  );
  const mutationFn = isPlatform ? createTable : createTableMigration;

  const mutation = useMutation(
    (variables) =>
      mutationFn({
        ...variables,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : customAdminSecret || currentProject?.config?.hasura.adminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
      }),
    mutationOptions,
  );

  return mutation;
}
