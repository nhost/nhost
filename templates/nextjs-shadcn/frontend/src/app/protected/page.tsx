import { redirect, unstable_rethrow } from 'next/navigation';
import { Todos } from '@/app/protected/Todos';
import { signInHref } from '@/app/signin/destination';
import { PageHeader } from '@/components/PageHeader';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';
import { isProfilePublic } from '@/lib/profile';

export const dynamic = 'force-dynamic';

// Read fresh rather than off the session: the claims in the token only change
// when it is refreshed, so changing the setting on the profile page would not
// show up here for as long as the current access token lives.
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

  // Guarded like the nav's identical read (`Nav.tsx`): a backend that is down,
  // still starting, or erroring must not take this page down with it. This
  // read only decides whether the sharing controls are offered, and the list
  // below reports a backend it cannot reach on its own.
  // `unstable_rethrow` lets the account-deleted `redirect()` inside the try
  // keep working as control flow instead of being swallowed as a failure.
  //
  // The session's own copy of `metadata` is the fallback rather than a flat
  // `false`. It is stale until the next token refresh, but it is this
  // account's actual setting, where `false` would hide the sharing controls
  // from everybody whenever the backend hiccups - and with the setting now on
  // by default, that is the wrong way to be wrong.
  let profilePublished = isProfilePublic(session.user.metadata);
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

    profilePublished = isProfilePublic(user.metadata);
  } catch (err) {
    unstable_rethrow(err);
    console.error('Could not read the profile visibility:', err);
  }

  return (
    // No status tiles here. "The backend is up" and "you are signed in" are
    // answered by this page rendering at all, and repeating them above the one
    // thing the page is for pushed it below the fold. Home still carries them,
    // where there may be no list to speak for itself.
    <div className="flex flex-col gap-8 pb-32">
      <PageHeader />
      <Todos userId={session.user.id} profilePublished={profilePublished} />
    </div>
  );
}
