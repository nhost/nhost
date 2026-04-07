import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { isEmptyValue } from '@/lib/utils';
import type {
  FunctionConfiguration,
  QualifiedFunction,
} from '@/utils/hasura-api/generated/schemas';

export interface FunctionCustomizationData {
  configuration?: FunctionConfiguration;
}

export interface UseFunctionCustomizationQueryOptions {
  function: QualifiedFunction;
  dataSource: string;
}

export default function useFunctionCustomizationQuery({
  function: fn,
  dataSource,
}: UseFunctionCustomizationQueryOptions) {
  return useExportMetadata((data): FunctionCustomizationData | undefined => {
    if (isEmptyValue(data.metadata.sources)) {
      return undefined;
    }

    const sourceMetadata = data.metadata.sources!.find(
      (source) => source.name === dataSource,
    );
    if (isEmptyValue(sourceMetadata?.functions)) {
      return undefined;
    }

    const functionMetadata = sourceMetadata!.functions!.find(
      (item) =>
        item.function.name === fn.name && item.function.schema === fn.schema,
    );

    if (!functionMetadata) {
      return undefined;
    }

    return {
      configuration: functionMetadata.configuration,
    };
  });
}
