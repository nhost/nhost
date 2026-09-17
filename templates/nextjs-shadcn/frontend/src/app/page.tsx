import { PageHeader } from '@/components/PageHeader';
import { StatusTiles } from '@/components/StatusTiles';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Nhost + Next.js + shadcn/ui">
        A full-stack starter. The backend lives in <code>backend/</code>; this
        app lives in <code>frontend/</code>.
      </PageHeader>

      <StatusTiles />
    </div>
  );
}
