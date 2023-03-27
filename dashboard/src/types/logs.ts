/**
 * This is a list of all the available services from which we can query.
 * Ideally we could fetch a list of available services, so this doesn't get out of sync,
 * and we can remove all the hard coded values here.
 */
export enum AvailableLogsServices {
  ALL = '',
  POSTGRES = 'postgres',
  AUTH = 'hasura-auth',
  STORAGE = 'hasura-storage',
  HASURA = 'hasura',
  FUNCTIONS = 'functions',
}

export type LogsCustomInterval = {
  /**
   * Label to be displayed in the UI.
   */
  label: string;
  /**
   * Value in minutes to decrease from the fetching query.
   */
  minutesToDecreaseFromCurrentDate: number;
};

export type Log = {
  /**
   * The log message
   */
  log: string;
  /**
   * The name of the service that generated the log.
   */
  service: string;
  /**
   * The time the log was created
   */
  timestamp: string;
};
