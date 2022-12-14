import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import type { Row } from 'react-table';
import type {
  UpdateRecordOptions,
  UpdateRecordVariables,
} from './updateRecord';
import updateRecord from './updateRecord';

export interface UseUpdateRecordMutationOptions<TData extends object = {}>
  extends Partial<UpdateRecordOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    Row<TData>,
    unknown,
    UpdateRecordVariables<TData>
  >;
}

/**
 * This hook is a wrapper around a fetch call that updates a row in the table.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useUpdateRecordMutation<TData extends object = {}>({
  dataSource: customDataSource,
  schema: customSchema,
  table: customTable,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseUpdateRecordMutationOptions<TData> = {}) {
  const {
    query: { dataSourceSlug, schemaSlug, tableSlug },
  } = useRouter();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const appUrl = generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region.awsName,
    'hasura',
  );

  const mutation = useMutation(
    (variables) =>
      updateRecord<TData>({
        ...variables,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : customAdminSecret || currentApplication?.hasuraGraphqlAdminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
        table: customTable || (tableSlug as string),
      }),
    mutationOptions,
  );

  return mutation;
}
