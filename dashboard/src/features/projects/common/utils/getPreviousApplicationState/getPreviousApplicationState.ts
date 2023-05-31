import type { ApplicationState } from '@/types/application';
import { ApplicationStatus } from '@/types/application';

type AcceptedState =
  | ApplicationStatus.Provisioning
  | ApplicationStatus.Unpausing
  | ApplicationStatus.Pausing
  | ApplicationStatus.Updating;

function checkIfAcceptedState(appState: ApplicationStatus) {
  return [
    ApplicationStatus.Provisioning,
    ApplicationStatus.Unpausing,
    ApplicationStatus.Pausing,
    ApplicationStatus.Updating,
  ].includes(appState);
}

/**
 * Determines the previous state of an application.
 * @param states An array of the states history for an application.
 */
export default function getPreviousApplicationState(
  states: ApplicationState[],
) {
  let previousAcceptedStateInHistory: AcceptedState;

  let wasTheApplicationPaused: boolean = false;
  let wasTheApplicationEverLive: boolean = false;

  // If we have two states or more states of ERROR, we want to check all the
  // states until we find an ACCEPTED_STATE and return that. The length of the
  // states will only be at maximum 10 specified in the query.
  states.forEach((state) => {
    const { stateId: previousAcceptedState } = state;
    const noPreviousEvent = !previousAcceptedStateInHistory;
    const isAcceptedState = checkIfAcceptedState(previousAcceptedState);

    if (previousAcceptedState === ApplicationStatus.Paused) {
      wasTheApplicationPaused = true;
    }

    if (previousAcceptedState === ApplicationStatus.Live) {
      wasTheApplicationEverLive = true;
    }

    if (noPreviousEvent && isAcceptedState) {
      previousAcceptedStateInHistory = previousAcceptedState as AcceptedState;
    }
  });

  const previousWasProvisioning =
    previousAcceptedStateInHistory === ApplicationStatus.Provisioning;
  const previousWasUnpausing =
    previousAcceptedStateInHistory === ApplicationStatus.Unpausing;
  const previousWasPausing =
    previousAcceptedStateInHistory === ApplicationStatus.Pausing;
  const previousWasUpdating =
    previousAcceptedStateInHistory === ApplicationStatus.Updating;

  // If the application is in an error state, wants to return provisioning as
  // the previous sate, and it was at one point LIVE; it probably means an
  // Updating state.
  // @GC.
  if (wasTheApplicationEverLive && previousWasProvisioning) {
    return ApplicationStatus.Updating;
  }

  // As long as this application was never paused, we want to return the
  // previousAcceptedStateInHistory being in provision.
  if (!wasTheApplicationPaused && previousWasProvisioning) {
    return ApplicationStatus.Provisioning;
  }
  // If the application was ever paused, has a current state of ERROR, and a
  // previous state of PROVISIONING, the backend has messed up. And this could
  // lead to recreating an application with data, when instead, we probably want
  // to unpause it.
  if (previousWasUnpausing) {
    return ApplicationStatus.Unpausing;
  }

  // The application should never get to this state.
  if (wasTheApplicationPaused && previousWasProvisioning) {
    return ApplicationStatus.Empty;
  }

  if (previousWasPausing) {
    return ApplicationStatus.Pausing;
  }

  if (previousWasUpdating) {
    return ApplicationStatus.Updating;
  }

  return ApplicationStatus.Empty;
}
