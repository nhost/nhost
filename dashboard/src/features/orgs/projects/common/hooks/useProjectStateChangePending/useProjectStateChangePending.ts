import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import type { ApplicationStatus } from '@/types/application';

/**
 * Safety net for a backend that accepts the request but never transitions.
 * Without it the button would stay disabled until the page is reloaded.
 */
const PENDING_TIMEOUT_MS = 60_000;

/**
 * Keeps a pause / wake up action marked as pending from the moment the user
 * clicks until the project state actually changes.
 *
 * The mutation itself resolves in well under a second, but the status tag only
 * appears once the polled project state changes, which can take several
 * seconds. Without this the button goes live again in between, with nothing
 * telling the user the request is already on its way.
 */
export default function useProjectStateChangePending() {
  const { state } = useAppState();
  const [isPending, setIsPending] = useState(false);

  const latestState = useRef<ApplicationStatus>(state);
  latestState.current = state;

  const stateAtStart = useRef<ApplicationStatus | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopPending = useCallback(() => {
    clearPendingTimeout();
    stateAtStart.current = null;
    setIsPending(false);
  }, [clearPendingTimeout]);

  const startPending = useCallback(() => {
    clearPendingTimeout();
    stateAtStart.current = latestState.current;
    setIsPending(true);

    timeoutRef.current = setTimeout(() => {
      setIsPending(false);
      stateAtStart.current = null;
      timeoutRef.current = null;
    }, PENDING_TIMEOUT_MS);
  }, [clearPendingTimeout]);

  // The project moved on, so the status tag is showing now and the button no
  // longer needs to carry the spinner.
  useEffect(() => {
    if (isPending && stateAtStart.current !== null && state !== stateAtStart.current) {
      stopPending();
    }
  }, [isPending, state, stopPending]);

  useEffect(() => clearPendingTimeout, [clearPendingTimeout]);

  return { isPending, startPending, stopPending };
}
