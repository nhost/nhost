import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import fetchFunctionDefinition from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery/fetchFunctionDefinition';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type {
  DeleteDatabaseObjectOptions,
  DeleteDatabaseObjectVariables,
} from './deleteDatabaseObject';
import deleteDatabaseObject from './deleteDatabaseObject';
import deleteDatabaseObjectMigration from './deleteDatabaseObjectMigration';

export interface UseDeleteDatabaseObjectVariables
  extends DeleteDatabaseObjectVariables {
  /**
   * Function OID. Used to fetch parameter types when type is FUNCTION.
   */
  functionOID?: string;
}

export interface UseDeleteDatabaseObjectMutationOptions
  extends Partial<DeleteDatabaseObjectOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    void,
    unknown,
    UseDeleteDatabaseObjectVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that deletes a database object
 * from the schema. When the object type is FUNCTION, it first fetches the
 * function definition to get parameter types needed for DROP FUNCTION.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteDatabaseObjectMutation({
  dataSource: customDataSource,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseDeleteDatabaseObjectMutationOptions = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const { project } = useProject();
  const mutationFn = isPlatform
    ? deleteDatabaseObject
    : deleteDatabaseObjectMigration;

  const mutation = useMutation(
    async (variables: UseDeleteDatabaseObjectVariables) => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      const finalAppUrl = customAppUrl || appUrl;
      const finalAdminSecret =
        process.env.NEXT_PUBLIC_ENV === 'dev'
          ? getHasuraAdminSecret()
          : customAdminSecret || project!.config!.hasura.adminSecret;
      const finalDataSource = customDataSource || (dataSourceSlug as string);

      let { inputArgTypes } = variables;

      if (
        variables.type === 'FUNCTION' &&
        !inputArgTypes &&
        variables.functionOID
      ) {
        const functionDefinition = await fetchFunctionDefinition({
          dataSource: finalDataSource,
          appUrl: finalAppUrl,
          adminSecret: finalAdminSecret,
          functionOID: variables.functionOID,
        });

        if (functionDefinition.error || !functionDefinition.functionMetadata) {
          throw new Error(
            functionDefinition.error ||
              'Failed to fetch function metadata. Cannot delete function without parameter types.',
          );
        }

        inputArgTypes = functionDefinition.functionMetadata.parameters;
      }

      return mutationFn({
        ...variables,
        inputArgTypes,
        appUrl: finalAppUrl,
        adminSecret: finalAdminSecret,
        dataSource: finalDataSource,
      });
    },
    mutationOptions,
  );

  return mutation;
}
