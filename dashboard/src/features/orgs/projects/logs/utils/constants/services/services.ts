/**
 * This is a list of all the available services from which we can query.
 * Ideally we could fetch a list of available services, so this doesn't get out of sync,
 * and we can remove all the hard coded values here.
 */
export enum CoreLogService {
  ALL = '',
  POSTGRES = 'postgres',
  AUTH = 'hasura-auth',
  STORAGE = 'hasura-storage',
  HASURA = 'hasura',
  FUNCTIONS = 'functions',
  GRAFANA = 'grafana',
  JOB_BACKUP = 'job-backup',
  AI = 'ai',
  CUSTOM_TEMPLATES_FETCHER = 'custom-templates-fetcher',
}

export const CORE_LOG_SERVICE_TO_LABEL: Required<
  Record<CoreLogService, string>
> = {
  [CoreLogService.ALL]: 'All Services',
  [CoreLogService.POSTGRES]: 'Postgres',
  [CoreLogService.AUTH]: 'Auth',
  [CoreLogService.STORAGE]: 'Storage',
  [CoreLogService.HASURA]: 'Hasura',
  [CoreLogService.FUNCTIONS]: 'Functions',
  [CoreLogService.GRAFANA]: 'Grafana',
  [CoreLogService.JOB_BACKUP]: 'Backup Jobs',
  [CoreLogService.AI]: 'AI',
  [CoreLogService.CUSTOM_TEMPLATES_FETCHER]: 'Custom Templates Fetcher',
};
