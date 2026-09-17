import { redirect } from 'next/navigation';
import { DeleteAccountCard } from '@/app/profile/DeleteAccountCard';
import { ProfileCard } from '@/app/profile/ProfileCard';
import { SecurityCard } from '@/app/profile/SecurityCard';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

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

export default async function Profile() {
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

  const metadata = user.metadata as { deletedAt?: string } | null;
  if (metadata?.deletedAt) {
    redirect('/restore');
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground">
          Everything here runs through the backend: the avatar through a
          function and storage, the rest through auth and per-user GraphQL
          permissions.
        </p>
      </div>

      <ProfileCard
        email={user.email ?? ''}
        emailVerified={user.emailVerified ?? false}
        displayName={user.displayName}
        newEmail={user.newEmail}
        avatarUrl={user.avatarUrl}
      />
      <SecurityCard hasPassword={user.hasPassword ?? false} />
      <DeleteAccountCard />
    </div>
  );
}
