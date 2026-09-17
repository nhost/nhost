import { redirect } from 'next/navigation';
import { Todos } from '@/app/protected/Todos';
import { PageHeader } from '@/components/PageHeader';
import { StatusTiles } from '@/components/StatusTiles';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Protected() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Protected page">
        Rendered on the server. It redirects to <code>/signin</code> when there
        is no session.
      </PageHeader>

      <StatusTiles />

      <Todos />
    </div>
  );
}
