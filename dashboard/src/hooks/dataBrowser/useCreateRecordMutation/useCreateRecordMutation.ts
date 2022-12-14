import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import type {
  CreateRecordOptions,
  CreateRecordVariables,
} from './createRecord';
import createRecord from './createRecord';

export interface UseCreateRecordMutationOptions<TData extends object = {}>
  extends Partial<CreateRecordOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    void,
    unknown,
    CreateRecordVariables<TData>
  >;
}

/**
 * This hook is a wrapper around a fetch call that inserts a record into the
 * table.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useCreateRecordMutation<TData extends object = {}>({
  dataSource: customDataSource,
  schema: customSchema,
  table: customTable,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseCreateRecordMutationOptions<TData> = {}) {
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
      createRecord<TData>({
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
