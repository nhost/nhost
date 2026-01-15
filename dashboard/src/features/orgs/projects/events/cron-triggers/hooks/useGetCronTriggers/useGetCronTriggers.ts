import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';
import getCronTriggers from './getCronTriggers';

export interface UseGetCronTriggersOptions {
  /**
   * Options passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      CronTrigger[],
      unknown,
      CronTrigger[],
      readonly ['get-cron-triggers', string | undefined]
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook is a wrapper around a fetch call that gets all the cron triggers of the project.
 *
 * @returns The cron triggers of the project.
 */
export default function useGetCronTriggers({
  queryOptions,
}: UseGetCronTriggersOptions = {}) {
  const { project, loading } = useProject();

  const query = useQuery(
    ['get-cron-triggers', project?.subdomain],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return getCronTriggers({
        appUrl,
        adminSecret,
      });
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
    },
  );

  return query;
}
