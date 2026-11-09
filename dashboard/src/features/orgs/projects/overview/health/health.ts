import {
  type GetProjectServicesHealthQuery,
  ServiceState,
} from '@/generated/graphql';

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

export const serviceStateToIndicatorClassName = new Map<
  ServiceState | undefined,
  string
>([
  [ServiceState.Running, 'bg-success'],
  [ServiceState.Error, 'bg-destructive'],
  [ServiceState.UpdateError, 'bg-destructive'],
  [ServiceState.Updating, 'bg-warning'],
  [ServiceState.None, 'bg-destructive'],
  [undefined, 'bg-muted-foreground'],
]);

export const serviceStateToLabel = new Map<ServiceState | undefined, string>([
  [ServiceState.Running, 'Running'],
  [ServiceState.Error, 'Error'],
  [ServiceState.UpdateError, 'Update failed'],
  [ServiceState.Updating, 'Updating'],
  [ServiceState.None, 'Not running'],
  [undefined, 'Unknown'],
]);

export const isServiceDown = (state?: ServiceState) =>
  state === ServiceState.Error ||
  state === ServiceState.UpdateError ||
  state === ServiceState.None;

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
