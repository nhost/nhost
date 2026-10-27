import Link from 'next/link';
import type { ReactNode } from 'react';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import CenteredLayout from '@/components/CenteredLayout';
import Code from '@/components/Code';
import SignOutLink from '@/components/SignOutLink';
import StackTitle from '@/components/StackTitle';
import { Button } from '@/components/ui/button';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border font-medium text-sm">
        {n}
      </span>
      <div className="flex flex-col gap-2 pt-0.5">
        <h2 className="font-medium">{title}</h2>
        <div className="flex flex-col gap-3 text-muted-foreground text-sm">
          {children}
        </div>
      </div>
    </li>
  );
}

/** The starter's front page: what this is and what to try first. */
export default async function Home() {
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;

  // Centred in a tall window like the sign-in pages, with room above the
  // marks that grows with the window rather than a fixed gap under the nav.
  return (
    <CenteredLayout>
      <div className="mx-auto flex max-w-2xl flex-col gap-12 pt-[10vh] pb-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <StackTitle />
          <p className="text-muted-foreground">
            An auth starter, rendered on the server.
          </p>
        </header>

        {/* Centred as a block, read down from the left inside it. */}
        <section className="flex flex-col gap-6 self-center">
          <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Get started
          </h2>
          <ol className="flex flex-col gap-8">
            <Step n={1} title="Create an account">
              {user ? (
                <p>Done: you are signed in as {user.email ?? user.id}.</p>
              ) : (
                <>
                  <p>Sign up with any of the ways the sign-in page offers.</p>
                  <div>
                    <Button asChild size="sm">
                      <Link href={signUpLink}>Sign up</Link>
                    </Button>
                  </div>
                </>
              )}
            </Step>

            <Step n={2} title="Explore your account">
              {/* The link is whichever half the visitor can do now: signed in,
                  signing out; signed out, the sign-in page, which a session
                  would only send on to the account. */}
              {user ? (
                <p>
                  Edit your profile and how you sign in, then{' '}
                  <SignOutLink>sign out</SignOutLink> and try another way in.
                </p>
              ) : (
                <p>
                  Edit your profile and how you sign in, then sign out and try{' '}
                  <Link
                    href={signInLink}
                    className="text-foreground underline underline-offset-4"
                  >
                    another way in
                  </Link>
                  .
                </p>
              )}
              {user ? (
                <div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/account">Go to your account</Link>
                  </Button>
                </div>
              ) : null}
            </Step>

            <Step n={3} title="Make it yours">
              <p>
                Edit <Code>src/app/page.tsx</Code>. Sign-in methods live in{' '}
                <Code>src/app/auth/</Code>.
              </p>
            </Step>
          </ol>
        </section>
      </div>
    </CenteredLayout>
  );
}
