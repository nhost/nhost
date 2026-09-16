import { redirect } from 'next/navigation';
import { Todos } from '@/app/protected/Todos';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Protected() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Protected page</h1>
        <p className="text-muted-foreground">
          Rendered on the server. It redirects to <code>/signin</code> when
          there is no session.
        </p>
      </div>

      <Todos />
    </div>
  );
}
