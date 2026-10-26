'use client';

import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { signOutSession } from '@/app/account/actions';
import { formatSessionTime, type SessionSummary } from '@/app/account/sessions';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { useSignOut } from '@/components/useSignOut';

const subscribeToNothing = () => () => undefined;

// False while the server renders and while React hydrates, true after. The
// server does not know the visitor's time zone, so it renders UTC, and the
// browser swaps in its own zone once hydration is done rather than during it,
// where a different time would be a mismatch.
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * One line per browser signed in to the account, each with a way to sign it
 * out. This one signs out the way the nav does, which clears its cookies and
 * goes home; the others have their row deleted.
 *
 * No dialog before signing one out: it reaches a single device, which can
 * sign in again.
 */
export default function SessionList({
  sessions,
}: {
  sessions: SessionSummary[];
}) {
  const router = useRouter();
  const toast = useToast();
  const hydrated = useHydrated();
  const [pending, setPending] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const here = useSignOut();

  const handleSignOut = async (session: SessionSummary): Promise<void> => {
    setError(undefined);
    setPending(session.id);
    try {
      const result = await signOutSession(session.id);
      if (result.error) {
        setError(result.error);
        return;
      }

      toast('Session signed out');
      router.refresh();
    } catch (err) {
      console.error('Error signing out a session:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setPending(undefined);
    }
  };

  return (
    <>
      {sessions.map((session) => {
        const time = hydrated
          ? formatSessionTime(session.lastActive)
          : `${formatSessionTime(session.lastActive, 'UTC')} UTC`;

        return (
          <li
            key={session.id}
            className="flex min-h-12 items-center gap-3 px-5 py-2 text-sm"
          >
            {/* Two lines that are each cut short rather than wrapped, so
                every session takes the same room: what it is, then where
                and when. */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="flex min-w-0 items-center gap-2">
                {/* Enough of the id to tell two alike sessions apart. */}
                <span
                  title={session.id}
                  className="shrink-0 rounded bg-secondary px-1.5 font-mono text-[11px] text-muted-foreground"
                >
                  {session.id.slice(0, 5)}
                </span>
                <span className="min-w-0 truncate">{session.device}</span>
                {session.current ? (
                  <span className="shrink-0 whitespace-nowrap rounded-full border bg-secondary px-2 text-xs">
                    This session
                  </span>
                ) : null}
              </p>
              <p className="truncate text-muted-foreground text-xs">
                {session.place ? `${session.place}, ` : null}
                <time dateTime={session.lastActive}>{time}</time>
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={Boolean(pending) || here.isSigningOut}
              onClick={() =>
                void (session.current
                  ? here.handleSignOut()
                  : handleSignOut(session))
              }
            >
              {(session.current ? here.isSigningOut : pending === session.id)
                ? 'Signing out…'
                : 'Sign out'}
            </Button>
          </li>
        );
      })}
      {(error ?? here.error) ? (
        <li role="alert" className="px-5 py-3 text-destructive text-sm">
          {error ?? here.error}
        </li>
      ) : null}
    </>
  );
}
