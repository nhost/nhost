import {
  type GetProjectServicesHealthQuery,
  ServiceState,
} from '@/generated/graphql';

export type ServiceHealthInfo =
  GetProjectServicesHealthQuery['getProjectStatus']['services'][number];

export type ServiceStateTone = 'success' | 'error' | 'warning' | 'secondary';

export const baseServices = {
  'hasura-auth': {
    displayName: 'Auth',
    softwareVersionsName: 'Auth',
  },
  hasura: {
    displayName: 'Hasura',
    softwareVersionsName: 'Hasura',
  },
  postgres: {
    displayName: 'Postgres',
    softwareVersionsName: 'PostgreSQL',
  },
  'hasura-storage': {
    displayName: 'Storage',
    softwareVersionsName: 'Storage',
  },
  ai: {
    displayName: 'Graphite',
    softwareVersionsName: 'Graphite',
  },
} as const;

export const serviceStateToIndicatorClassName = new Map<
  ServiceState | undefined,
  string
>([
  [ServiceState.Running, 'bg-emerald-600'],
  [ServiceState.Error, 'bg-destructive'],
  [ServiceState.UpdateError, 'bg-destructive'],
  [ServiceState.Updating, 'bg-amber-500'],
  [ServiceState.None, 'bg-destructive'],
  [undefined, 'bg-grey-500'],
]);

export const serviceStateToBadgeColor = new Map<
  ServiceState | undefined,
  ServiceStateTone
>([
  [ServiceState.Running, 'success'],
  [ServiceState.Error, 'error'],
  [ServiceState.UpdateError, 'error'],
  [ServiceState.Updating, 'warning'],
  [ServiceState.None, 'error'],
  [undefined, 'secondary'],
]);

/**
 * Returns the highest importance state from a list of service states
 * Example: [Running, Running, Error] => Error
 */
export const findHighestImportanceState = (
  servicesStates: ServiceState[],
): ServiceState => {
  const serviceStateToImportance = {
    [ServiceState.Running]: 0,
    [ServiceState.Updating]: 1,
    [ServiceState.UpdateError]: 2,
    [ServiceState.Error]: 3,
    [ServiceState.None]: 4,
  } as const;

  if (servicesStates.length === 0) {
    return ServiceState.None;
  }

  return servicesStates.reduce((acc, state) => {
    if (serviceStateToImportance[state] > serviceStateToImportance[acc]) {
      return state;
    }
    return acc;
  }, ServiceState.Running);
};
