import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Timestamp: any;
  bigint: any;
  float64: any;
  labels: any;
  map: any;
  uuid: any;
};

export type BackupPresignedUrl = {
  __typename?: 'BackupPresignedURL';
  expires_at: Scalars['Timestamp'];
  url: Scalars['String'];
};

export type BackupResult = {
  __typename?: 'BackupResult';
  backupID: Scalars['uuid'];
  size: Scalars['bigint'];
};

export type BackupResultsItem = {
  __typename?: 'BackupResultsItem';
  appID: Scalars['uuid'];
  backupID: Scalars['uuid'];
  error: Scalars['String'];
  size: Scalars['bigint'];
  success: Scalars['Boolean'];
};

export type Log = {
  __typename?: 'Log';
  log: Scalars['String'];
  service: Scalars['String'];
  timestamp: Scalars['Timestamp'];
};

export type Metrics = {
  __typename?: 'Metrics';
  value: Scalars['float64'];
};

export type Mutation = {
  __typename?: 'Mutation';
  backupAllApplicationsDatabase: Array<Maybe<BackupResultsItem>>;
  backupApplicationDatabase: BackupResult;
  pauseInactiveApps: Array<Scalars['String']>;
  resetPostgresPassword: Scalars['Boolean'];
  restoreApplicationDatabase: Scalars['Boolean'];
  sendEmailTemplate: Scalars['Boolean'];
};


export type MutationBackupAllApplicationsDatabaseArgs = {
  expireInDays?: InputMaybe<Scalars['Int']>;
};


export type MutationBackupApplicationDatabaseArgs = {
  appID: Scalars['String'];
  expireInDays?: InputMaybe<Scalars['Int']>;
};


export type MutationResetPostgresPasswordArgs = {
  appID: Scalars['String'];
  newPassword: Scalars['String'];
};


export type MutationRestoreApplicationDatabaseArgs = {
  appID: Scalars['String'];
  backupID: Scalars['String'];
};


export type MutationSendEmailTemplateArgs = {
  from: Scalars['String'];
  templateAlias: Scalars['String'];
  templateModel?: InputMaybe<Scalars['map']>;
  to: Scalars['String'];
};

export type Query = {
  __typename?: 'Query';
  getBackupPresignedURL: BackupPresignedUrl;
  getCPUSecondsUsage: Metrics;
  getEgressVolume: Metrics;
  getFunctionsInvocations: Metrics;
  getLogsVolume: Metrics;
  getPostgresVolumeCapacity: Metrics;
  getPostgresVolumeUsage: Metrics;
  getTotalRequests: Metrics;
  /**
   * Returns logs for a given application. If `service` is not provided all services are returned.
   * If `from` and `to` are not provided, they default to an hour ago and now, respectively.
   */
  logs: Array<Log>;
  /**
   * Returns lists of apps that have some live traffic in the give time range.
   * From defaults to 24 hours ago and to defaults to now.
   *
   * Requests that returned a 4xx or 5xx status code are not counted as live traffic.
   */
  statsLiveApps: StatsLiveApps;
};


export type QueryGetBackupPresignedUrlArgs = {
  appID: Scalars['String'];
  backupID: Scalars['String'];
  expireInMinutes?: InputMaybe<Scalars['Int']>;
};


export type QueryGetCpuSecondsUsageArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type QueryGetEgressVolumeArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  subdomain: Scalars['String'];
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type QueryGetFunctionsInvocationsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type QueryGetLogsVolumeArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type QueryGetPostgresVolumeCapacityArgs = {
  appID: Scalars['String'];
  t?: InputMaybe<Scalars['Timestamp']>;
};


export type QueryGetPostgresVolumeUsageArgs = {
  appID: Scalars['String'];
  t?: InputMaybe<Scalars['Timestamp']>;
};


export type QueryGetTotalRequestsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type QueryLogsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  service?: InputMaybe<Scalars['String']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type QueryStatsLiveAppsArgs = {
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};

export type StatsLiveApps = {
  __typename?: 'StatsLiveApps';
  appID: Array<Scalars['uuid']>;
  count: Scalars['Int'];
};

export type Subscription = {
  __typename?: 'Subscription';
  /**
   * Returns logs for a given application. If `service` is not provided all services are returned.
   * If `from` is not provided, it defaults to an hour ago.
   */
  logs: Array<Log>;
};


export type SubscriptionLogsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  service?: InputMaybe<Scalars['String']>;
};

export type GetLogsSubscriptionSubscriptionVariables = Exact<{
  appID: Scalars['String'];
  service?: InputMaybe<Scalars['String']>;
  from?: InputMaybe<Scalars['Timestamp']>;
}>;


export type GetLogsSubscriptionSubscription = { __typename?: 'Subscription', logs: Array<{ __typename?: 'Log', log: string, service: string, timestamp: any }> };


export const GetLogsSubscriptionDocument = gql`
    subscription getLogsSubscription($appID: String!, $service: String, $from: Timestamp) {
  logs(appID: $appID, service: $service, from: $from) {
    log
    service
    timestamp
  }
}
    `;

/**
 * __useGetLogsSubscriptionSubscription__
 *
 * To run a query within a React component, call `useGetLogsSubscriptionSubscription` and pass it any options that fit your needs.
 * When your component renders, `useGetLogsSubscriptionSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetLogsSubscriptionSubscription({
 *   variables: {
 *      appID: // value for 'appID'
 *      service: // value for 'service'
 *      from: // value for 'from'
 *   },
 * });
 */
export function useGetLogsSubscriptionSubscription(baseOptions: Apollo.SubscriptionHookOptions<GetLogsSubscriptionSubscription, GetLogsSubscriptionSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<GetLogsSubscriptionSubscription, GetLogsSubscriptionSubscriptionVariables>(GetLogsSubscriptionDocument, options);
      }
export type GetLogsSubscriptionSubscriptionHookResult = ReturnType<typeof useGetLogsSubscriptionSubscription>;
export type GetLogsSubscriptionSubscriptionResult = Apollo.SubscriptionResult<GetLogsSubscriptionSubscription>;