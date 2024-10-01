import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  useGetApplicationStateQuery,
  useGetSystemLogsQuery,
  type GetApplicationStateQuery,
  type GetApplicationStateQueryVariables,
  type GetSystemLogsQuery,
  type GetSystemLogsQueryVariables,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import type { ApolloError, QueryHookOptions } from '@apollo/client';
import { useVisibilityChange } from '@uidotdev/usehooks';
import { useEffect } from 'react';

export interface UseIsDatabaseMigratingOptions
  extends QueryHookOptions<
    GetApplicationStateQuery,
    GetApplicationStateQueryVariables
  > {
  shouldPoll?: boolean;
}

export interface UseMigrationLogsOptions
  extends QueryHookOptions<GetSystemLogsQuery, GetSystemLogsQueryVariables> {
  shouldPoll?: boolean;
}

export interface Log {
  level: string;
  msg: string;
  time: string;
}

/*
 * Returns logs for the current database migration.
 * @param options - Options for the getSystemLogs query.
 * @returns - An object with three properties:
 * - logs: Logs for the current/latest database migration.
 * - loading: true if the getLogs query is in a loading state.
 * - error: Error object if the query failed.
 */
export default function useMigrationLogs(
  options: UseMigrationLogsOptions = {},
): {
  logs: Partial<Log>[];
  loading: boolean;
  error: ApolloError;
} {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isVisible = useVisibilityChange();

  const { data: appStatesData } = useGetApplicationStateQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
  });

  const migrationStartTimestamp = appStatesData?.app?.appStates?.find(
    (state) => state.stateId === ApplicationStatus.Migrating,
  )?.createdAt;

  const from = new Date(migrationStartTimestamp);

  const { data, loading, error, startPolling, stopPolling } =
    useGetSystemLogsQuery({
      ...options,
      variables: {
        ...options.variables,
        appID: currentProject.id,
        action: 'change-database-version',
        from,
      },
      skip: !currentProject || !from,
      skipPollAttempt: () => !isVisible,
    });

  useEffect(() => {
    if (options.shouldPoll) {
      startPolling(options.pollInterval || 5000);
    }

    return () => stopPolling();
  }, [stopPolling, startPolling, options.shouldPoll, options.pollInterval]);

  const systemLogs = data?.systemLogs ?? [];
  const sortedLogs = [...systemLogs];
  sortedLogs.sort(
    (a, b) => new Date(a.timestamp).valueOf() - new Date(b.timestamp).valueOf(),
  ); // sort in ascending order

  const logs = sortedLogs.map(({ log }) => {
    let logObj: Partial<Log> = {};
    try {
      logObj = JSON.parse(log);
      return logObj;
    } catch (e) {
      console.error('Failed to parse log', log);
      return undefined;
    }
  });

  return {
    logs,
    loading,
    error,
  };
}
