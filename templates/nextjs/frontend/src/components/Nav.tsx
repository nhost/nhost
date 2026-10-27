import Link from 'next/link';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { methods } from '@/app/signin/methods';
import { signInQuery } from '@/app/signin/query';
import NavAccount from '@/components/NavAccount';
import NhostLogo from '@/components/NhostLogo';
import RefreshOnSessionChange from '@/components/RefreshOnSessionChange';
import SignOutButton from '@/components/SignOutButton';
import UserAvatar from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { createNhostClient } from '@/lib/nhost/server';

const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;

const signedOutPaths = methods.flatMap((method) => method.signedOutPaths ?? []);

export default async function Nav() {
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <RefreshOnSessionChange signedIn={!!user} />
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <NhostLogo className="size-5" />
          Nhost
        </Link>

        <NavAccount
          signedOutPaths={signedOutPaths}
          signedIn={
            user ? (
              <div className="flex items-center gap-3">
                <SignOutButton />
                {/* The picture rather than the address: the address is already
                    on the account page this leads to, and at nav width a long
                    one crowded the sign-out beside it. */}
                <Link
                  href="/account"
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <UserAvatar
                    avatarUrl={user.avatarUrl}
                    displayName={user.displayName}
                    width={64}
                    className="size-8 text-xs"
                  />
                  <span className="sr-only">Your account</span>
                </Link>
              </div>
            ) : null
          }
          signedOut={
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href={signInLink}>Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={signUpLink}>Sign up</Link>
              </Button>
            </div>
          }
        />
      </div>
    </nav>
  );
}
