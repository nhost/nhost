import { redirect } from 'next/navigation';
import { RestoreAccountCard } from '@/app/restore/RestoreAccountCard';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// The template marks and restores accounts, but the actual purge after the
// grace period is left to the project: see the README.
const GRACE_DAYS = 30;

const GetDeletionMark = graphql(`
  query GetDeletionMark($id: uuid!) {
    user(id: $id) {
      id
      metadata
    }
  }
`);

export default async function Restore() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (!session?.user) {
    redirect('/signin');
  }

  const { user } = await gqlRequest(nhost, GetDeletionMark, {
    id: session.user.id,
  });

  const deletedAt = (user?.metadata as { deletedAt?: string } | null)
    ?.deletedAt;
  if (!deletedAt) {
    redirect('/profile');
  }

  const purgeDate = new Date(
    new Date(deletedAt).getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          This account is scheduled for deletion
        </h1>
        <p className="text-muted-foreground">
          You asked to delete it. Nothing is gone yet: restoring below simply
          removes the mark.
        </p>
      </div>

      <RestoreAccountCard
        purgeDate={purgeDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      />
    </div>
  );
}
