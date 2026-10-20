import { useEffect, useRef } from 'react';
import type {
  PreloadLibrary,
  PreloadLibraryStatus,
} from '@/features/orgs/projects/database/extensions/hooks/usePreloadLibrary';
import type { InstallStepState } from './InstallStep';

// The library is in the settings, but Postgres has not loaded it.
const AWAITING_RESTART_STATUSES = new Set<PreloadLibraryStatus>([
  'restarting',
  'pending-local-restart',
  'restart-failed',
]);

function getInstallBlockedReason(
  extensionName: string,
  preload?: PreloadLibrary,
): string | null {
  if (!preload || preload.status === 'preloaded') {
    return null;
  }

  return AWAITING_RESTART_STATUSES.has(preload.status)
    ? `Postgres has not loaded ${extensionName} yet.`
    : `Add ${extensionName} to preloaded libraries first.`;
}

/**
 * Tracks the preload and install steps of the install dialog, and moves focus
 * to the Install button once the preload step completes.
 */
export default function useInstallExtensionSteps(
  extensionName: string,
  preload?: PreloadLibrary,
) {
  // Shown in a tooltip on a wrapper around the disabled Install button, which
  // gets no pointer events itself.
  const installBlockedReason = getInstallBlockedReason(extensionName, preload);
  const canInstall = installBlockedReason === null;
  const installButtonRef = useRef<HTMLButtonElement>(null);
  const couldInstall = useRef(canInstall);

  useEffect(() => {
    if (canInstall && !couldInstall.current) {
      installButtonRef.current?.focus();
    }

    couldInstall.current = canInstall;
  }, [canInstall]);

  const preloadStepState: InstallStepState = canInstall
    ? 'complete'
    : 'current';
  const installStepState: InstallStepState = canInstall
    ? 'current'
    : 'upcoming';

  return {
    canInstall,
    installBlockedReason,
    installButtonRef,
    preloadStepState,
    installStepState,
  };
}
