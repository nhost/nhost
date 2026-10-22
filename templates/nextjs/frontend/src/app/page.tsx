import Link from 'next/link';
import type { ReactNode } from 'react';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import StackTitle from '@/components/StackTitle';
import { Button } from '@/components/ui/button';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  );
}

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

/**
 * The starter's front page: what this is and what to try first.
 *
 * Auth is what the template is for, so the first step is signing up and the
 * rest point at where to take it from there. The nav already carries sign in
 * and sign out, so nothing here repeats the session beyond the first step
 * saying it is done.
 *
 * No method is named here: `methods.ts` decides which exist, and the sign-in
 * page this links to is what lists them.
 */
export default async function Home() {
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 py-6">
      <header className="flex flex-col gap-3">
        <StackTitle />
        <p className="text-muted-foreground">
          An auth starter, rendered on the server.
        </p>
      </header>

      <section className="flex flex-col gap-6">
        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Get started
        </h2>
        <ol className="flex flex-col gap-8">
          <Step n={1} title="Create an account">
            {user ? (
              <p>Done: you are signed in as {user.email ?? user.id}.</p>
            ) : (
              <>
                <p>Sign up, then open the link in the verification email.</p>
                <div>
                  <Button asChild size="sm">
                    <Link href={signUpLink}>Sign up</Link>
                  </Button>
                </div>
              </>
            )}
          </Step>

          <Step n={2} title="Explore your account">
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
  );
}
