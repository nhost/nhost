import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import ProjectLayout from '@/components/layout/ProjectLayout';
import LogsBody from '@/components/logs/LogsBody';
import LogsHeader from '@/components/logs/LogsHeader';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClientWithSubscriptions } from '@/hooks/useRemoteApplicationGQLClientWithSubscriptions';
import { AvailableLogsServices } from '@/types/logs';
import {
  GetLogsSubscriptionDocument,
  useGetProjectLogsQuery,
} from '@/utils/__generated__/graphql';
import { subMinutes } from 'date-fns';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const MINUTES_TO_DECREASE_FROM_CURRENT_DATE = 20;

export default function LogsPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [fromDate, setFromDate] = useState<Date>(
    subMinutes(new Date(), MINUTES_TO_DECREASE_FROM_CURRENT_DATE),
  );
  const [toDate, setToDate] = useState<Date | null>(new Date());
  const [service, setService] = useState<AvailableLogsServices>(
    AvailableLogsServices.ALL,
  );

  const clientWithSplit = useRemoteApplicationGQLClientWithSubscriptions();
  const subscriptionReturn = useRef(null);

  /**
   * Will change the specific service from which we query logs.
   */
  function handleServiceChange(value: AvailableLogsServices) {
    setService(value);
  }

  const { data, loading, error, subscribeToMore, client } =
    useGetProjectLogsQuery({
      variables: {
        appID: currentApplication.id,
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
          appID: currentApplication.id,
          service,
          from: fromDate,
        },
        updateQuery: (prev, { subscriptionData }) => {
          if (!subscriptionData.data) {
            return prev;
          }

          // if there are no previous logs just return the new ones
          if (!prev.logs || prev.logs.length === 0) {
            return subscriptionData.data;
          }

          const previousLogsLength = prev.logs.length;
          const newLogsLength = subscriptionData.data.logs.length;
          const timestampOfFirstPreviousLog = prev.logs[0].timestamp;
          const timestampOfFirstSubscriptionLog =
            subscriptionData.data.logs[newLogsLength - 1].timestamp;
          const sameLogs =
            previousLogsLength === newLogsLength &&
            timestampOfFirstPreviousLog === timestampOfFirstSubscriptionLog;

          if (sameLogs) {
            return subscriptionData.data;
          }

          const newLogs = subscriptionData.data.logs;

          return {
            ...prev,
            logs: [...newLogs, ...prev.logs],
          };
        },
      }),
    [subscribeToMore, currentApplication.id, service, fromDate],
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
    <div className="flex flex-col w-full h-full">
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
    <ProjectLayout mainContainerProps={{ className: 'bg-gray-50' }}>
      {page}
    </ProjectLayout>
  );
};
