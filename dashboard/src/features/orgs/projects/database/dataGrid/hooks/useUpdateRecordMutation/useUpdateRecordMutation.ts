import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
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

  const { project } = useProject();

  const appUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'hasura',
  );

  const mutation = useMutation(
    (variables) =>
      updateRecord<TData>({
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
