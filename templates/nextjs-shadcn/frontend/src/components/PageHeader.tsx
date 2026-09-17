import { ViewToggle } from '@/components/ViewToggle';
import { createNhostClient } from '@/lib/nhost/server';

/**
 * The header both views share.
 *
 * Home and the protected page are two views of the same starter rather than
 * two unrelated pages, so they carry the same title and the toggle says which
 * one you are looking at. Keeping it identical is also what stops the content
 * under it moving when you switch.
 *
 * On a wide screen the toggle sits out to the right, under the account menu it
 * lines up with, which buys back the row it used to take up. It drops back
 * under the title when there is no room for both.
 */
export async function PageHeader() {
  const nhost = await createNhostClient();
  const signedIn = Boolean(nhost.getUserSession());

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-bold text-4xl tracking-tight">
          Nhost + Next.js + shadcn/ui
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A full-stack starter. The backend lives in <code>backend/</code>; this
          app lives in <code>frontend/</code>.
        </p>
      </div>

      <ViewToggle signedIn={signedIn} />
    </div>
  );
}
