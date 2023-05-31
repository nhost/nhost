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
