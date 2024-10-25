import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { LogsBody } from '@/features/projects/logs/components/LogsBody';
import {
  LogsHeader,
  type LogsFilterFormValues,
} from '@/features/projects/logs/components/LogsHeader';
import { AvailableLogsService } from '@/features/projects/logs/utils/constants/services';
import { useRemoteApplicationGQLClientWithSubscriptions } from '@/hooks/useRemoteApplicationGQLClientWithSubscriptions';
import { MINUTES_TO_DECREASE_FROM_CURRENT_DATE } from '@/utils/constants/common';
import {
  GetLogsSubscriptionDocument,
  useGetProjectLogsQuery,
} from '@/utils/__generated__/graphql';
import { subMinutes } from 'date-fns';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';

interface LogsFilters {
  from: Date;
  to: Date | null;
  service: AvailableLogsService;
  regexFilter: string;
}

export default function LogsPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  // create a client that sends http requests to Hasura but websocket requests to Bragi
  const clientWithSplit = useRemoteApplicationGQLClientWithSubscriptions();
  const subscriptionReturn = useRef(null);

  const [filters, setFilters] = useState<LogsFilters>({
    from: subMinutes(new Date(), MINUTES_TO_DECREASE_FROM_CURRENT_DATE),
    to: new Date(),
    regexFilter: '',
    service: AvailableLogsService.ALL,
  });

  const { data, error, subscribeToMore, client, loading, refetch } =
    useGetProjectLogsQuery({
      variables: { appID: currentProject.id, ...filters },
      client: clientWithSplit,
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    });

  const subscribeToMoreLogs = useCallback(
    () =>
      subscribeToMore({
        document: GetLogsSubscriptionDocument,
        variables: {
          appID: currentProject.id,
          service: filters.service,
          from: filters.from,
          regexFilter: filters.regexFilter,
        },
        updateQuery: (prev, { subscriptionData }) => {
          // if there is no new data, just return the previous data
          if (!subscriptionData.data) {
            return prev;
          }

          const prevLogs = prev.logs;

          // if there are no previous logs just return the new ones
          if (!prevLogs || prevLogs.length === 0) {
            return subscriptionData.data;
          }

          const newLogs = subscriptionData.data.logs;

          // Next, we need to understand if the new logs are the same as the previous ones.
          // We'll then pick the first log from `prev` and see if we can find it in `subscriptionData.data`.
          // If it exists, we'll assume that the logs are the same and we'll return `prev`.
          // NOTE: We can't compare elements in the array because they are sent out of order.
          // The logs are sorted by timestamp in the LogsBody component.

          const prevAndNewLogsAreTheSame = newLogs.some(
            (log) =>
              log.timestamp === prevLogs[0].timestamp &&
              log.service === prevLogs[0].service,
          );

          if (prevAndNewLogsAreTheSame) {
            return prev;
          }

          // if the logs are not the same, it means we've got new logs. We'll merge the new logs with the existing logs.
          return {
            logs: [...prevLogs, ...newLogs],
          };
        },
      }),
    [subscribeToMore, currentProject.id, filters],
  );

  useEffect(() => {
    if (filters.to && subscriptionReturn.current !== null) {
      subscriptionReturn.current();
      subscriptionReturn.current = null;

      return () => {};
    }

    if (filters.to) {
      return () => {};
    }

    if (subscriptionReturn.current) {
      subscriptionReturn.current();
      subscriptionReturn.current = null;
    }

    // This will open the websocket connection and it will return a function to close it.
    subscriptionReturn.current = subscribeToMoreLogs();

    return () => {};
  }, [filters, subscribeToMoreLogs, client]);

  const onSubmitFilterValues = useCallback(
    async (values: LogsFilterFormValues) => {
      setFilters({ ...(values as LogsFilters) });
      await refetch();
    },
    [setFilters, refetch],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <RetryableErrorBoundary>
        <LogsHeader
          loading={loading}
          onSubmitFilterValues={onSubmitFilterValues}
        />
        <LogsBody error={error} loading={loading} logsData={data} />
      </RetryableErrorBoundary>
    </div>
  );
}

LogsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
