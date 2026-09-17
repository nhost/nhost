import { StatusTiles } from '@/components/StatusTiles';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-bold text-4xl tracking-tight">
          Nhost + Next.js + shadcn/ui
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A full-stack starter. The backend (auth, database and GraphQL API)
          lives in <code>backend/</code>; this app lives in{' '}
          <code>frontend/</code>.
        </p>
      </div>

      <StatusTiles />
    </div>
  );
}
