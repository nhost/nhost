import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import fetchFunctionDefinition from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery/fetchFunctionDefinition';
import type { DeleteFunctionOptions, DeleteFunctionVariables } from './deleteFunction';
import deleteFunction from './deleteFunction';

export interface UseDeleteFunctionMutationOptions
  extends Partial<DeleteFunctionOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<void, unknown, DeleteFunctionVariables>;
}

/**
 * This hook is a wrapper around a fetch call that deletes a function from the
 * schema. It first fetches the function metadata to get the parameter types
 * required for the DROP FUNCTION statement.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useDeleteFunctionMutation({
  dataSource: customDataSource,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseDeleteFunctionMutationOptions = {}) {
  const {
    query: { dataSourceSlug },
  } = useRouter();
  const { project } = useProject();

  const mutation = useMutation(async (variables: DeleteFunctionVariables) => {
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

    // First, fetch the function definition to get the parameter types
    const functionDefinition = await fetchFunctionDefinition({
      dataSource: finalDataSource,
      appUrl: finalAppUrl,
      adminSecret: finalAdminSecret,
      schema: variables.schema,
      functionName: variables.functionName,
    });

    if (functionDefinition.error || !functionDefinition.functionMetadata) {
      throw new Error(
        functionDefinition.error ||
          'Failed to fetch function metadata. Cannot delete function without parameter types.',
      );
    }

    // Extract parameter types from the function metadata
    const inputArgTypes = functionDefinition.functionMetadata.parameters;

    // Now delete the function with the parameter types
    return deleteFunction({
      ...variables,
      inputArgTypes,
      appUrl: finalAppUrl,
      adminSecret: finalAdminSecret,
      dataSource: finalDataSource,
    });
  }, mutationOptions);

  return mutation;
}
