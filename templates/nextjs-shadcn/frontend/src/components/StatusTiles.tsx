import Link from 'next/link';
import { testConnection } from '@/app/actions';
import { ConnectionTile } from '@/components/ConnectionTile';
import { SignInLink } from '@/components/SignInLink';
import { StatusTile } from '@/components/StatusTile';
import { Button } from '@/components/ui/button';
import { createNhostClient } from '@/lib/nhost/server';

/**
 * Live state of the two things that are true of every page: the backend is
 * reachable, and you are signed in or not.
 *
 * Shared by both views, so the answers cannot drift between them, and
 * identical on each, so nothing moves when you switch. Whether the app has any
 * data is not a property of the page, it is a property of the todos, so it is
 * reported there instead.
 */
export async function StatusTiles() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  const connection = await testConnection();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ConnectionTile initial={connection} />

      <StatusTile
        state={session ? 'ok' : 'pending'}
        title={session ? 'Signed in' : 'Not signed in'}
        action={
          session ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">Your profile</Link>
            </Button>
          ) : (
            <SignInLink variant="outline" />
          )
        }
      >
        {session ? (
          <>
            <span className="font-medium text-foreground">
              {session.user?.email}
            </span>
            , on both the server and the browser.
          </>
        ) : (
          <>
            Sign in with a one-time code. Running locally, that email is caught
            by the mail viewer.
          </>
        )}
      </StatusTile>
    </div>
  );
}
