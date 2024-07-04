import {
  ServiceState,
  type GetProjectServicesHealthQuery,
} from '@/utils/__generated__/graphql';

export type ServiceHealthInfo =
  GetProjectServicesHealthQuery['getProjectStatus']['services'][number];

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

export const serviceStateToThemeColor = new Map<ServiceState, string>([
  [ServiceState.Running, 'success.dark'],
  [ServiceState.Error, 'error.main'],
  [ServiceState.UpdateError, 'error.main'],
  [ServiceState.Updating, 'warning.dark'],
  [ServiceState.None, 'error.main'],
  [undefined, 'error.main'],
]);

export const serviceStateToBadgeColor = new Map<
  ServiceState,
  'success' | 'error' | 'warning'
>([
  [ServiceState.Running, 'success'],
  [ServiceState.Error, 'error'],
  [ServiceState.UpdateError, 'error'],
  [ServiceState.Updating, 'warning'],
  [ServiceState.None, 'error'],
  [undefined, 'error'],
]);

/**
 * Returns the highest importance state from a list of service states
 * Example: [Running, Running, Error] => Error
 */
export const findHighestImportanceState = (
  servicesStates: ServiceState[],
): ServiceState => {
  const serviceStateToImportance = new Map([
    [ServiceState.Running, 0],
    [ServiceState.Updating, 1],
    [ServiceState.UpdateError, 2],
    [ServiceState.Error, 3],
    [ServiceState.None, 4],
  ]);

  if (servicesStates.length === 0) {
    return ServiceState.None;
  }

  return servicesStates.reduce((acc, state) => {
    if (
      serviceStateToImportance.get(state) > serviceStateToImportance.get(acc)
    ) {
      return state;
    }
    return acc;
  }, ServiceState.Running);
};
