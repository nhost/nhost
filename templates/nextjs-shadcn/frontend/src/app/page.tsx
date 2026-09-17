import { PageHeader } from '@/components/PageHeader';
import { StatusTiles } from '@/components/StatusTiles';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader />
      <StatusTiles />
    </div>
  );
}
