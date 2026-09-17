import { redirect } from 'next/navigation';
import { Todos } from '@/app/protected/Todos';
import { signInHref } from '@/app/signin/destination';
import { PageHeader } from '@/components/PageHeader';
import { StatusTiles } from '@/components/StatusTiles';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Protected() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  // Reached directly rather than through a link, so this is a full load: send
  // them to the sign-in page carrying the way back here.
  if (!session) {
    redirect(signInHref('/protected'));
  }

  return (
    <div className="flex flex-col gap-8 pb-32">
      <PageHeader />

      {/* The tiles and the todos card are one group of cards, spaced like the
          tiles are spaced from each other. Only the header stands apart. */}
      <div className="flex flex-col gap-4">
        <StatusTiles />
        <Todos />
      </div>
    </div>
  );
}
