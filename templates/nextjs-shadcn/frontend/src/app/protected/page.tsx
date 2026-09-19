import { redirect, unstable_rethrow } from 'next/navigation';
import { Todos } from '@/app/protected/Todos';
import { signInHref } from '@/app/signin/destination';
import { PageHeader } from '@/components/PageHeader';
import { StatusTiles } from '@/components/StatusTiles';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// Read fresh rather than off the session: the claims in the token only change
// when it is refreshed, so publishing on the profile page would not show up
// here for as long as the current access token lives.
const GetProfileVisibility = graphql(`
  query GetProfileVisibility($id: uuid!) {
    user(id: $id) {
      id
      metadata
    }
  }
`);

export default async function Protected() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  // Reached directly rather than through a link, so this is a full load: send
  // them to the sign-in page carrying the way back here.
  if (!session?.user) {
    redirect(signInHref('/protected'));
  }

  // Guarded like the nav's identical read (`Nav.tsx`): a backend that is
  // down, still starting, or erroring must not take this page down with it,
  // since `StatusTiles` two lines below exists specifically to report that.
  // `unstable_rethrow` lets the account-deleted `redirect()` inside the try
  // keep working as control flow instead of being swallowed as a failure.
  let profilePublished = false;
  try {
    const { user } = await gqlRequest(nhost, GetProfileVisibility, {
      id: session.user.id,
    });

    // A signed token whose user is gone: the account was deleted outright
    // while this access token was still inside its lifetime, so nothing has
    // had cause to refresh and find out. Every write would fail on the
    // foreign key from `todos.user_id`, so ask for a fresh sign-in instead of
    // letting the database explain it.
    if (!user) {
      redirect(signInHref('/protected'));
    }

    const metadata = user.metadata as { publicProfile?: boolean } | null;
    profilePublished = metadata?.publicProfile === true;
  } catch (err) {
    unstable_rethrow(err);
    console.error('Could not read the profile visibility:', err);
  }

  return (
    <div className="flex flex-col gap-8 pb-32">
      <PageHeader />

      {/* The tiles and the todos card are one group of cards, spaced like the
          tiles are spaced from each other. Only the header stands apart. */}
      <div className="flex flex-col gap-4">
        <StatusTiles />
        <Todos userId={session.user.id} profilePublished={profilePublished} />
      </div>
    </div>
  );
}
