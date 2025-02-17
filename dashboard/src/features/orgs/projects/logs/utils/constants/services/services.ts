/**
 * This is a list of all the available services from which we can query.
 * Ideally we could fetch a list of available services, so this doesn't get out of sync,
 * and we can remove all the hard coded values here.
 */
export enum AvailableLogsService {
  ALL = '',
  POSTGRES = 'postgres',
  AUTH = 'hasura-auth',
  STORAGE = 'hasura-storage',
  HASURA = 'hasura',
  FUNCTIONS = 'functions',
  GRAFANA = 'grafana',
  JOB_BACKUP = 'job-backup',
  AI = 'ai',
}

export const LOGS_SERVICE_TO_LABEL: Required<
  Record<AvailableLogsService, string>
> = {
  [AvailableLogsService.ALL]: 'All Services',
  [AvailableLogsService.POSTGRES]: 'Postgres',
  [AvailableLogsService.AUTH]: 'Auth',
  [AvailableLogsService.STORAGE]: 'Storage',
  [AvailableLogsService.HASURA]: 'Hasura',
  [AvailableLogsService.FUNCTIONS]: 'Functions',
  [AvailableLogsService.GRAFANA]: 'Grafana',
  [AvailableLogsService.JOB_BACKUP]: 'Backup Jobs',
  [AvailableLogsService.AI]: 'AI',
};
