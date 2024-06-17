import { type GetProjectServicesHealthQuery, ServiceState } from '@/utils/__generated__/graphql';

export type ServiceHealthInfo = GetProjectServicesHealthQuery["getProjectStatus"]["services"][number];

export const baseServices = {
  "hasura-auth": {
    displayName: "Auth",
    softwareVersionsName: "Auth"
  },
  "hasura": {
    displayName: "Hasura",
    softwareVersionsName: "Hasura",
  },
  "postgres": {
    displayName: "Postgres",
    softwareVersionsName: "PostgreSQL",
  },
  "hasura-storage": {
    displayName: "Storage",
    softwareVersionsName: "Storage"
  },
  "ai": {
    displayName: "Graphite",
    softwareVersionsName: "Graphite"
  }
} as const;

export const serviceStateToThemeColor = new Map<ServiceState, string>([
  [ServiceState.Running, 'success.dark'],
  [ServiceState.Error, 'error.main'],
  [ServiceState.UpdateError, 'error.main'],
  [ServiceState.Updating, 'warning.dark'],
  [ServiceState.None, 'error.main'],
  [undefined, 'error.main'],
]);

export const serviceStateToBadgeColor = new Map<ServiceState, 'success' | 'error' | 'warning'>([
  [ServiceState.Running, 'success'],
  [ServiceState.Error, 'error'],
  [ServiceState.UpdateError, 'error'],
  [ServiceState.Updating, 'warning'],
  [ServiceState.None, 'error'],
  [undefined, 'error'],
]);

export const getServiceHealthState = (
  serviceState: ServiceState,
): 'success' | 'error' | 'warning' => {
  switch (serviceState) {
    case ServiceState.Running:
      return 'success';
    case ServiceState.Error:
      return 'error';
    case ServiceState.UpdateError:
      return 'error';
    case ServiceState.Updating:
      return 'warning';
    default:
      return 'error';
  }
};

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
    if (serviceStateToImportance.get(state) > serviceStateToImportance.get(acc)) {
      return state;
    }
    return acc;
  }, ServiceState.Running);
};

/* JSON stringify replacer that removes __typename from the object */
const typenameReplacer = (key, value) => {
  if (key === '__typename') {
    return undefined;
  }

  return value;
};

/**
 * Returns a stringified JSON representation of the object with all __typename keys removed
 */
export const stringifyHealthJSON = (obj: any) =>
  JSON.stringify(obj, typenameReplacer, 2);
