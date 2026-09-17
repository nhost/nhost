import Link from 'next/link';
import { testConnection } from '@/app/actions';
import { ConnectionTile } from '@/components/ConnectionTile';
import { StatusTile } from '@/components/StatusTile';
import { Button } from '@/components/ui/button';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// Whether this user has written anything yet. Aggregations are not enabled on
// the todos permission, and one row is all this needs to know.
const HasTodos = graphql(`
  query HasTodos {
    todos(limit: 1) {
      id
    }
  }
`);

export default async function Home() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  const connection = await testConnection();

  let hasTypedData = false;
  if (connection.ok && session?.user) {
    try {
      const { todos } = await gqlRequest(nhost, HasTodos, {});
      hasTypedData = todos.length > 0;
    } catch (err) {
      console.error('Could not check for existing todos:', err);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-bold text-4xl tracking-tight">
          Nhost + Next.js + shadcn/ui
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A full-stack starter. The backend (auth, database and GraphQL API)
          lives in <code>backend/</code>; this app lives in{' '}
          <code>frontend/</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <Button asChild size="sm">
                <Link href="/signin">Sign in</Link>
              </Button>
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
              Sign in with a one-time code. Running locally, that email is
              caught by the mail viewer.
            </>
          )}
        </StatusTile>

        <StatusTile
          state={hasTypedData ? 'ok' : 'pending'}
          title={hasTypedData ? 'Typed data' : 'No data yet'}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/protected">
                {hasTypedData ? 'Your todos' : 'Open the protected page'}
              </Link>
            </Button>
          }
        >
          {hasTypedData ? (
            <>
              Reading <code>todos</code> through a generated type and your own
              row-level permissions.
            </>
          ) : (
            <>
              A per-user <code>todos</code> table with a typed query and
              mutation is already wired up.
            </>
          )}
        </StatusTile>
      </div>
    </div>
  );
}
