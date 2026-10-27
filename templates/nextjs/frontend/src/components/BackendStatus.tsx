'use client';

import { useEffect, useState } from 'react';
import {
  dashboardURL,
  isLocalBackend,
  nhostRegion,
  nhostSubdomain,
} from '@/lib/nhost/env';
import { isBackendReachable } from '@/lib/nhost/health';

type Status = 'checking' | 'connected' | 'offline';

// Often enough that stopping `nhost up` shows within seconds of looking back
// at the page, and only while the tab is visible. Local stack only, see below.
const POLL_MS = 10_000;

const LABELS: Record<Status, string> = {
  checking: 'Checking',
  connected: 'Connected',
  offline: 'Offline',
};

function useBackendStatus(): Status {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    // A slow check must not overwrite the answer of one started after it.
    let latest = 0;
    let active = true;

    const check = async (): Promise<void> => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      const run = ++latest;
      const reachable = await isBackendReachable();
      if (active && run === latest) {
        setStatus(reachable ? 'connected' : 'offline');
      }
    };

    const recheck = (): void => {
      void check();
    };

    recheck();
    // Polled only against the local stack, where it is what shows `nhost up`
    // stopping.
    const interval = isLocalBackend()
      ? window.setInterval(recheck, POLL_MS)
      : undefined;
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('online', recheck);
    window.addEventListener('offline', recheck);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('online', recheck);
      window.removeEventListener('offline', recheck);
    };
  }, []);

  return status;
}

/**
 * Which backend this build talks to and whether it is answering, linking to
 * where it is managed.
 */
export default function BackendStatus() {
  const local = isLocalBackend();
  const status = useBackendStatus();
  const linked = status === 'connected' || (status === 'offline' && !local);

  const name = local ? 'Nhost Local' : 'Nhost Cloud';

  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span
        aria-hidden="true"
        className={
          status === 'connected'
            ? 'size-2 rounded-full bg-emerald-400'
            : 'size-2 rounded-full bg-muted-foreground/60'
        }
      />
      <span>
        {LABELS[status]}:{' '}
        {linked ? (
          <a
            href={dashboardURL()}
            target="_blank"
            rel="noreferrer"
            title={
              local ? undefined : `${nhostSubdomain()} in ${nhostRegion()}`
            }
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {name}
            {status === 'connected' ? (
              <>
                {' '}
                <span aria-hidden="true">↗</span>
              </>
            ) : null}
          </a>
        ) : (
          <span className="font-medium text-foreground">{name}</span>
        )}
      </span>
    </span>
  );
}
