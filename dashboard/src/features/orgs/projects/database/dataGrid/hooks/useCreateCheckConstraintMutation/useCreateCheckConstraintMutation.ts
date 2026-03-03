import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import type { QueryError } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';

export interface CreateCheckConstraintVariables {
  /**
   * Name of the check constraint.
   */
  constraintName: string;
  /**
   * Check expression (e.g., "price > 0").
   */
  checkExpression: string;
}

export interface UseCreateCheckConstraintMutationOptions {
  /**
   * Schema where the table is located.
   */
  schema: string;
  /**
   * Table name.
   */
  table: string;
  /**
   * Data source name.
   */
  dataSource?: string;
  /**
   * Options for the mutation.
   */
  mutationOptions?: Omit<
    UseMutationOptions<void, Error, CreateCheckConstraintVariables>,
    'mutationFn'
  >;
}

export default function useCreateCheckConstraintMutation({
  schema,
  table,
  dataSource: customDataSource,
  mutationOptions,
}: UseCreateCheckConstraintMutationOptions) {
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const { project } = useProject();

  const dataSource =
    customDataSource || (dataSourceSlug as string) || 'default';

  const appUrl = generateAppServiceUrl(
    project!.subdomain,
    project!.region,
    'hasura',
  );

  const adminSecret =
    process.env.NEXT_PUBLIC_ENV === 'dev'
      ? getHasuraAdminSecret()
      : project!.config!.hasura.adminSecret;

  const mutation = useMutation({
    mutationFn: async ({
      constraintName,
      checkExpression,
    }: CreateCheckConstraintVariables) => {
      const sql = `ALTER TABLE "${schema}"."${table}" ADD CONSTRAINT "${constraintName}" CHECK (${checkExpression});`;

      const response = await fetch(`${appUrl}/v2/query`, {
        method: 'POST',
        headers: {
          'x-hasura-admin-secret': adminSecret,
        },
        body: JSON.stringify({
          type: 'run_sql',
          args: {
            source: dataSource,
            sql,
            cascade: false,
            read_only: false,
          },
        }),
      });

      const responseData = await response.json();

      if (!response.ok || 'error' in responseData) {
        const normalizedError = normalizeQueryError(responseData as QueryError);
        throw new Error(normalizedError);
      }
    },
    ...mutationOptions,
  });

  return mutation;
}
