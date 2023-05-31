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
}

export const LOGS_AVAILABLE_SERVICES: {
  label: string;
  value: AvailableLogsService;
}[] = [
  {
    label: 'All Services',
    value: AvailableLogsService.ALL,
  },
  {
    label: 'Postgres',
    value: AvailableLogsService.POSTGRES,
  },
  {
    label: 'Auth',
    value: AvailableLogsService.AUTH,
  },
  {
    label: 'Storage',
    value: AvailableLogsService.STORAGE,
  },
  {
    label: 'Hasura',
    value: AvailableLogsService.HASURA,
  },
  {
    label: 'Functions',
    value: AvailableLogsService.FUNCTIONS,
  },
];
