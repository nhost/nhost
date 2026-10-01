import Link from 'next/link';
import NhostLogo from '@/components/NhostLogo';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import { createNhostClient } from '@/lib/nhost/server';

export default async function Nav() {
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <NhostLogo className="size-5" />
          Nhost
        </Link>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">
              {user.email ?? user.id}
            </span>
            <SignOutButton />
          </div>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
