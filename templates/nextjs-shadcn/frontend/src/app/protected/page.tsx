import { redirect } from 'next/navigation';
import { Todos } from '@/app/protected/Todos';
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
      <div className="flex flex-col gap-3">
        <h1 className="font-bold text-4xl tracking-tight">Protected page</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Rendered on the server. It redirects to <code>/signin</code> when
          there is no session.
        </p>
      </div>

      <StatusTiles />

      <Todos />
    </div>
  );
}
