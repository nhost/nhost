import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import { createNhostClient } from '@/lib/nhost/server';

export default async function Nav() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-semibold">
          Nhost + Next.js
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Home</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/protected">Protected</Link>
          </Button>

          {session ? (
            <SignOutButton />
          ) : (
            <Button asChild size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
