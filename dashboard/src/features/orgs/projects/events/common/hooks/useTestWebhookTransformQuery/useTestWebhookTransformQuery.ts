import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  TestWebhookTransformArgs,
  TestWebhookTransformResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { HasuraError } from '@/utils/hasura-api/types';
import testWebhookTransform from './testWebhookTransform';

export interface UseTestWebhookTransformQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      TestWebhookTransformResponse,
      HasuraError,
      TestWebhookTransformResponse,
      readonly ['test-webhook-transform', TestWebhookTransformArgs]
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook is a wrapper around a test webhook transform call.
 *
 * @param args - Arguments for the query.
 * @returns The result of the query.
 */
export default function useTestWebhookTransformQuery(
  args: TestWebhookTransformArgs,
  { queryOptions }: UseTestWebhookTransformQueryOptions = {},
) {
  const { project, loading } = useProject();

  const query = useQuery(
    ['test-webhook-transform', args],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return testWebhookTransform({
        appUrl,
        adminSecret,
        args,
      });
    },
    {
      keepPreviousData: true,
      ...queryOptions,
      retry: false,
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        args.webhook_url &&
        queryOptions?.enabled !== false &&
        !loading
      ),
    },
  );

  return query;
}
