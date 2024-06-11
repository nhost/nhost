import { ServiceState } from '@/utils/__generated__/graphql';

export const serviceStateToColor = new Map<ServiceState, string>([
  [ServiceState.Running, 'success.dark'],
  [ServiceState.Error, 'error.main'],
  [ServiceState.UpdateError, 'error.main'],
  [ServiceState.Updating, 'warning.dark'],
  [ServiceState.None, 'error.main'],
  [undefined, 'error.main'],
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

export const getUserRunServiceState = (
  servicesStates: ServiceState[],
): 'success' | 'error' | 'warning' => {
  if (
    servicesStates.some(
      (state) =>
        state === ServiceState.Error ||
        state === ServiceState.UpdateError ||
        state === ServiceState.None,
    )
  ) {
    return 'error';
  }

  if (servicesStates.some((state) => state === ServiceState.Updating)) {
    return 'warning';
  }

  return 'success';
};

const serviceStateToImportance = {
  [ServiceState.Running]: 0,
  [ServiceState.Updating]: 1,
  [ServiceState.UpdateError]: 2,
  [ServiceState.Error]: 3,
  [ServiceState.None]: 4,
};

export const findHighestImportanceState = (
  servicesStates: ServiceState[],
): ServiceState => {
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
