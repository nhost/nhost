import { NextStep } from '@/components/NextStep';
import { PageHeader } from '@/components/PageHeader';
import { StatusTiles } from '@/components/StatusTiles';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const nhost = await createNhostClient();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader />
      <StatusTiles />
      {nhost.getUserSession() ? <NextStep /> : null}
    </div>
  );
}
