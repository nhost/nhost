import { redirect } from 'next/navigation';
import { DeleteAccountCard } from '@/app/profile/DeleteAccountCard';
import { EmailCard } from '@/app/profile/EmailCard';
import { ProfileCard } from '@/app/profile/ProfileCard';
import { PublicProfileCard } from '@/app/profile/PublicProfileCard';
import { SecurityCard } from '@/app/profile/SecurityCard';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { appOrigin } from '@/lib/nhost/env';
import { createNhostClient } from '@/lib/nhost/server';

const GetProfile = graphql(`
  query GetProfile($id: uuid!) {
    user(id: $id) {
      id
      displayName
      email
      newEmail
      emailVerified
      avatarUrl
      hasPassword
      metadata
    }
  }
`);

/**
 * The profile itself, without the heading around it.
 *
 * Both renderings of the route share this, so the page and the modal cannot
 * end up reading different data or guarding it differently. The heading is
 * left out because each renders its own: a page has an `h1`, a dialog has a
 * title that also names it for assistive technology.
 */
export async function ProfilePanel() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (!session?.user) {
    redirect('/signin');
  }

  const { user } = await gqlRequest(nhost, GetProfile, {
    id: session.user.id,
  });

  if (!user) {
    redirect('/signin');
  }

  const metadata = user.metadata as {
    deletedAt?: string;
    publicProfile?: boolean;
  } | null;
  if (metadata?.deletedAt) {
    redirect('/restore');
  }

  // Read here rather than in the card, so the card can stay a client component
  // without reaching for `window` and disagreeing with what the server
  // rendered. Configured rather than read off this request's headers, for the
  // reason `appOrigin` gives.
  const origin = appOrigin();

  return (
    <div className="flex flex-col gap-4">
      <ProfileCard
        userId={String(user.id)}
        email={user.email ?? ''}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
      />
      <PublicProfileCard
        userId={String(user.id)}
        origin={origin}
        published={metadata?.publicProfile === true}
      />
      <EmailCard
        email={user.email ?? ''}
        emailVerified={user.emailVerified ?? false}
        newEmail={user.newEmail}
        hasPassword={user.hasPassword ?? false}
      />
      <SecurityCard hasPassword={user.hasPassword ?? false} />
      <DeleteAccountCard />
    </div>
  );
}
