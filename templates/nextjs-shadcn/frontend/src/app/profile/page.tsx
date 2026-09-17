import { redirect } from 'next/navigation';
import { AvatarCard } from '@/app/profile/AvatarCard';
import { DeleteAccountCard } from '@/app/profile/DeleteAccountCard';
import { DisplayNameCard } from '@/app/profile/DisplayNameCard';
import { EmailCard } from '@/app/profile/EmailCard';
import { PasswordCard } from '@/app/profile/PasswordCard';
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
          Everything on this page runs through the backend: the avatar through a
          function and storage, the rest through auth and per-user GraphQL
          permissions.
        </p>
      </div>

      <AvatarCard avatarUrl={user.avatarUrl} displayName={user.displayName} />
      <DisplayNameCard displayName={user.displayName} />
      <EmailCard email={user.email ?? ''} newEmail={user.newEmail} />
      <PasswordCard />
      <DeleteAccountCard />
    </div>
  );
}
