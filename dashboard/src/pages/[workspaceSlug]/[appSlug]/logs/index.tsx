import DepricationNotice from '@/components/common/DepricationNotice/DepricationNotice';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { LogsBody } from '@/features/projects/logs/components/LogsBody';
import { LogsHeader } from '@/features/projects/logs/components/LogsHeader';
import { AvailableLogsService } from '@/features/projects/logs/utils/constants/services';
import { useRemoteApplicationGQLClientWithSubscriptions } from '@/hooks/useRemoteApplicationGQLClientWithSubscriptions';
import {
  GetLogsSubscriptionDocument,
  useGetProjectLogsQuery,
} from '@/utils/__generated__/graphql';
import { subMinutes } from 'date-fns';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const MINUTES_TO_DECREASE_FROM_CURRENT_DATE = 20;

export default function LogsPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [fromDate, setFromDate] = useState<Date>(
    subMinutes(new Date(), MINUTES_TO_DECREASE_FROM_CURRENT_DATE),
  );
  const [toDate, setToDate] = useState<Date | null>(new Date());
  const [service, setService] = useState<AvailableLogsService>(
    AvailableLogsService.ALL,
  );

  // create a client that sends http requests to Hasura but websocket requests to Bragi
  const clientWithSplit = useRemoteApplicationGQLClientWithSubscriptions();
  const subscriptionReturn = useRef(null);

  /**
   * Will change the specific service from which we query logs.
   */
  function handleServiceChange(value: AvailableLogsService) {
    setService(value);
  }

  const { data, loading, error, subscribeToMore, client } =
    useGetProjectLogsQuery({
      variables: {
        appID: currentProject.id,
        from: fromDate,
        to: toDate,
        service,
      },
      client: clientWithSplit,
    });

  const subscribeToMoreLogs = useCallback(
    () =>
      subscribeToMore({
        document: GetLogsSubscriptionDocument,
        variables: {
          appID: currentProject.id,
          service,
          from: fromDate,
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
    [subscribeToMore, currentProject.id, service, fromDate],
  );

  useEffect(() => {
    if (toDate && subscriptionReturn.current !== null) {
      subscriptionReturn.current();
      subscriptionReturn.current = null;

      return () => {};
    }

    if (toDate) {
      return () => {};
    }

    // This will open the websocket connection and it will return a function to close it.
    subscriptionReturn.current = subscribeToMoreLogs();

    // get rid of the current apollo client instance (will also close the websocket if it's the live status)
    return () => client.stop();
  }, [subscribeToMoreLogs, toDate, client]);

  return (
    <div className="flex h-full w-full flex-col">
      <RetryableErrorBoundary>
        <LogsHeader
          fromDate={fromDate}
          toDate={toDate}
          service={service}
          onServiceChange={handleServiceChange}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
        />

        <LogsBody error={error} loading={loading} logsData={data} />
      </RetryableErrorBoundary>
    </div>
  );
}

LogsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout>
      <DepricationNotice />
      {page}
    </ProjectLayout>
  );
};
