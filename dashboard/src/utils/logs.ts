import type { LogsCustomInterval } from '@/types/logs';
import { AvailableLogsServices } from '@/types/logs';

export const availableServices: {
  label: string;
  value: AvailableLogsServices;
}[] = [
  {
    label: 'All Services',
    value: AvailableLogsServices.ALL,
  },
  {
    label: 'Postgres',
    value: AvailableLogsServices.POSTGRES,
  },
  {
    label: 'Auth',
    value: AvailableLogsServices.AUTH,
  },
  {
    label: 'Storage',
    value: AvailableLogsServices.STORAGE,
  },
  {
    label: 'Hasura',
    value: AvailableLogsServices.HASURA,
  },
  {
    label: 'Functions',
    value: AvailableLogsServices.FUNCTIONS,
  },
];

export const logsCustomIntervals: LogsCustomInterval[] = [
  {
    label: '5 min',
    minutesToDecreaseFromCurrentDate: 5,
  },
  {
    label: '15 min',
    minutesToDecreaseFromCurrentDate: 15,
  },
  {
    label: '30 min',
    minutesToDecreaseFromCurrentDate: 30,
  },
  {
    label: '60 min',
    minutesToDecreaseFromCurrentDate: 60,
  },
];

// If we want to cap the logs to a specific time instead of the application creation date, use this constant.
export const LOGS_AVAILABLE_DAYS_FROM_NOW = 6;
