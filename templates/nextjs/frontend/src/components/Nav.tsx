import Link from 'next/link';
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
          className="font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
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
            <Link href="/signin?intent=sign-in">Sign in</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
