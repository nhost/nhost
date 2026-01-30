import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchExportMetadata } from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  ExportMetadataResponse,
  ExportMetadataResponseMetadataSourcesItemFunctionsItem,
  FunctionConfiguration,
} from '@/utils/hasura-api/generated/schemas';

export interface QualifiedFunction {
  name: string;
  schema: string;
}

export interface FunctionCustomizationData {
  configuration?: FunctionConfiguration;
}

export interface UseFunctionCustomizationQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: UseQueryOptions<
    ExportMetadataResponse,
    unknown,
    FunctionCustomizationData | undefined
  >;
  /**
   * The function to get the customization for.
   */
  function: QualifiedFunction;
  /**
   * The data source to get the customization for.
   */
  dataSource: string;
}

/**
 * This hook gets the function customization from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useFunctionCustomizationQuery({
  function: fn,
  dataSource,
  queryOptions,
}: UseFunctionCustomizationQueryOptions) {
  const { project, loading } = useProject();

  const query = useQuery<
    ExportMetadataResponse,
    unknown,
    FunctionCustomizationData | undefined
  >(
    ['export-metadata', project?.subdomain],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return fetchExportMetadata({ appUrl, adminSecret });
    },
    {
      ...queryOptions,
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        queryOptions?.enabled !== false &&
        !loading
      ),
      select: (data) => {
        if (!data.metadata.sources) {
          return undefined;
        }

        const sourceMetadata = data.metadata.sources.find(
          (item) => item.name === dataSource,
        );
        if (!sourceMetadata?.functions) {
          return undefined;
        }

        const functionMetadata:
          | ExportMetadataResponseMetadataSourcesItemFunctionsItem
          | undefined = sourceMetadata.functions.find(
          (item) =>
            item.function.name === fn.name &&
            item.function.schema === fn.schema,
        );

        if (!functionMetadata) {
          return undefined;
        }

        return {
          configuration: functionMetadata.configuration,
        };
      },
    },
  );

  return query;
}
