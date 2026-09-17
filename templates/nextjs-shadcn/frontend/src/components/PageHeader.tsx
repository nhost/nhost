import { ViewToggle } from '@/components/ViewToggle';

/**
 * The header both views share.
 *
 * Home and the protected page are two views of the same starter rather than
 * two unrelated pages, so they carry the same title and the toggle below it
 * says which one you are looking at. Keeping it identical is also what stops
 * the content under it moving when you switch.
 */
export function PageHeader() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-bold text-4xl tracking-tight">
          Nhost + Next.js + shadcn/ui
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A full-stack starter. The backend lives in <code>backend/</code>; this
          app lives in <code>frontend/</code>.
        </p>
      </div>

      <ViewToggle />
    </div>
  );
}
