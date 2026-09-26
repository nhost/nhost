import { redirect } from 'next/navigation';
import { RestoreAccountCard } from '@/app/restore/RestoreAccountCard';
import { RestoredCard } from '@/app/restore/RestoredCard';
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

  const sessionMark = (
    session.user.metadata as { deletedAt?: string } | null | undefined
  )?.deletedAt;

  // Marked on neither side: an ordinary signed-in visitor who typed the URL or
  // kept a bookmark. The proxy only sends anyone here while their session
  // carries the mark, so this redirect cannot be bounced back. Without it they
  // are told their account has just been restored and handed a button that
  // rotates their refresh token for nothing.
  if (!deletedAt && !sessionMark) {
    redirect('/profile');
  }

  // Restored in the database, while this browser's session still carries the
  // mark - restored on another device, most likely, since restoring does not
  // revoke the other sessions. Redirecting to `/profile` here would loop: the
  // proxy reads the mark from the session rather than the database and would
  // send them straight back, for as long as the access token stays valid. The
  // card refreshes the session from a server action instead, which is where a
  // cookie write belongs.
  if (!deletedAt) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-3xl tracking-tight">
            Your account is restored
          </h1>
          <p className="text-muted-foreground">
            Nothing was deleted. This device just needs to catch up.
          </p>
        </div>

        <RestoredCard />
      </div>
    );
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
