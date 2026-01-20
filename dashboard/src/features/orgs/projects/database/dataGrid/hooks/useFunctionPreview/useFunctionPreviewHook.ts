import { useRouter } from 'next/router';
import { useState } from 'react';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import type { FunctionPreviewResult } from './useFunctionPreview';
import { fetchFunctionPreview } from './useFunctionPreview';

export interface UseFunctionPreviewHookOptions {
  schema: string;
  functionName: string;
  dataSource?: string;
  limit?: number;
  parameters?: (string | number | null)[];
}

export function useFunctionPreviewHook() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FunctionPreviewResult | null>(null);
  const router = useRouter();
  const { project } = useProject();
  const {
    query: { dataSourceSlug },
  } = router;

  const runPreview = async ({
    schema,
    functionName,
    dataSource,
    limit = 20,
    parameters = [],
  }: UseFunctionPreviewHookOptions) => {
    setLoading(true);
    setResult(null);

    try {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );
      const adminSecret =
        process.env.NEXT_PUBLIC_ENV === 'dev'
          ? getHasuraAdminSecret()
          : project!.config!.hasura.adminSecret;

      const previewResult = await fetchFunctionPreview({
        dataSource: dataSource || (dataSourceSlug as string) || 'default',
        schema,
        table: functionName,
        appUrl,
        adminSecret,
        limit,
        parameters,
      });

      setResult(previewResult);
    } catch (error) {
      setResult({
        columns: [],
        rows: [],
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while executing function preview.',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    runPreview,
    loading,
    result,
  };
}
