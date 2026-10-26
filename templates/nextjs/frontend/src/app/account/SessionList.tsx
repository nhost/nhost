'use client';

import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { signOutSession } from '@/app/account/actions';
import ConfirmAction from '@/app/account/ConfirmAction';
import { formatSessionTime, type SessionSummary } from '@/app/account/sessions';
import Dialog from '@/components/Dialog';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { useRemoved } from '@/components/useRemoved';
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
 * Asked first: the lines look alike, and the session a stray click ends is
 * on a device that may not be at hand to sign in again. Each line holds its
 * own dialog, since a list can only hold lines.
 */
export default function SessionList({
  sessions: listed,
}: {
  sessions: SessionSummary[];
}) {
  const router = useRouter();
  const toast = useToast();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<string | undefined>();
  const here = useSignOut();

  // Another session leaves the list as soon as it is signed out, rather than
  // once the refreshed page arrives (see `useRemoved`), and comes back only
  // if the server refused.
  const { removed, remove, restore } = useRemoved();
  const sessions = listed.filter((session) => !removed.has(session.id));

  // The dialog closes on confirming: this session's line then says it is
  // signing out until the home page arrives, and another's leaves the list.
  const handleConfirm = async (session: SessionSummary): Promise<undefined> => {
    setConfirming(undefined);
    if (session.current) {
      here.handleSignOut();
    } else {
      void handleSignOut(session);
    }
    return undefined;
  };

  const handleSignOut = async (session: SessionSummary): Promise<void> => {
    setError(undefined);
    remove(session.id);
    try {
      const result = await signOutSession(session.id);
      if (result.error) {
        restore(session.id);
        setError(result.error);
        return;
      }

      toast('Session signed out');
      router.refresh();
    } catch (err) {
      console.error('Error signing out a session:', err);
      restore(session.id);
      setError('The request did not reach the server. Try again.');
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
              disabled={here.isSigningOut}
              aria-haspopup="dialog"
              onClick={() => setConfirming(session.id)}
            >
              {session.current && here.isSigningOut
                ? 'Signing out…'
                : 'Sign out'}
            </Button>
            <Dialog
              open={confirming === session.id}
              onOpenChange={(open) => {
                if (!open) {
                  setConfirming(undefined);
                }
              }}
              title={
                session.current
                  ? 'Sign out of this browser?'
                  : 'Sign out this session?'
              }
              description={
                session.current
                  ? "You'll go back to the home page and need to sign in again here."
                  : `${[session.device, session.place].filter(Boolean).join(', ')} will need to sign in again.`
              }
            >
              <ConfirmAction
                confirm="Sign out"
                pending="Signing out…"
                destructive
                onConfirm={() => handleConfirm(session)}
              />
            </Dialog>
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
