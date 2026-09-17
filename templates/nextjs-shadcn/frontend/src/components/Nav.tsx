import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';

const GetNavProfile = graphql(`
  query GetNavProfile($id: uuid!) {
    user(id: $id) {
      id
      displayName
      avatarUrl
    }
  }
`);

export default async function Nav() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  // The session's user claims only refresh with the token, so the avatar is
  // read fresh; when the backend is unreachable the nav falls back to them
  // rather than failing the whole page.
  let avatarUrl = session?.user?.avatarUrl;
  if (session?.user) {
    try {
      const { user } = await gqlRequest(nhost, GetNavProfile, {
        id: session.user.id,
      });
      avatarUrl = user?.avatarUrl ?? avatarUrl;
    } catch {
      // Keep the session's claims; the nav must not take the page down.
    }
  }

  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-semibold">
          Nhost + Next.js + shadcn/ui
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Home</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/protected">Protected</Link>
          </Button>

          {session ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/profile" className="flex items-center gap-2">
                  {avatarUrl ? (
                    // biome-ignore lint/performance/noImgElement: tiny remote image whose host varies per environment
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-5 w-5 rounded-full border object-cover"
                    />
                  ) : null}
                  Profile
                </Link>
              </Button>
              <SignOutButton />
            </>
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
