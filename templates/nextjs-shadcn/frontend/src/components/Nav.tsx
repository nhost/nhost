import Link from 'next/link';
import { NextMark, NhostMark, ShadcnMark } from '@/components/BrandMarks';
import { SignInLink } from '@/components/SignInLink';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from '@/components/UserMenu';
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

// Separates the marks without being read out as a word.
function Cross() {
  return (
    <span
      aria-hidden="true"
      className="font-normal text-xl text-muted-foreground"
    >
      ×
    </span>
  );
}

export default async function Nav() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  const user = session?.user;

  // The session's user claims only refresh with the token, so the avatar and
  // name are read fresh; when the backend is unreachable the nav falls back to
  // the claims rather than failing the whole page.
  let profile = {
    displayName: user?.displayName,
    avatarUrl: user?.avatarUrl,
  };

  if (user) {
    try {
      const { user: fresh } = await gqlRequest(nhost, GetNavProfile, {
        id: user.id,
      });

      if (fresh) {
        profile = {
          displayName: fresh.displayName ?? profile.displayName,
          avatarUrl: fresh.avatarUrl ?? profile.avatarUrl,
        };
      }
    } catch {
      // Keep the session's claims; the nav must not take the page down.
    }
  }

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          aria-label="Nhost, Next.js and shadcn/ui: back to home"
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <NhostMark />
          <Cross />
          <NextMark />
          <Cross />
          <ShadcnMark />
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />

          {user ? (
            <UserMenu
              email={user.email ?? ''}
              displayName={profile.displayName}
              avatarUrl={profile.avatarUrl}
            />
          ) : (
            <SignInLink />
          )}
        </div>
      </div>
    </nav>
  );
}
