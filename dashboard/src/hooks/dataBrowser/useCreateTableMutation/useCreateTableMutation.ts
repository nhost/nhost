import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
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

  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const appUrl = generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region.awsName,
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
            ? 'nhost-admin-secret'
            : customAdminSecret || currentApplication?.hasuraGraphqlAdminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
      }),
    mutationOptions,
  );

  return mutation;
}
