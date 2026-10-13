import Link from 'next/link';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import AuthErrorNotice from '@/components/AuthErrorNotice';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;

// This is where auth emails and the OAuth callback land by default, so it is
// also where the auth service reports a flow that failed.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    errorDescription?: string | string[];
  }>;
}) {
  const { error, errorDescription } = await searchParams;
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <AuthErrorNotice error={error} description={errorDescription} />
      <Card>
        <CardHeader>
          <CardTitle>
            {user ? 'You are signed in' : 'You are not signed in'}
          </CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email ?? user.id}.`
              : 'Create an account, or sign in to one you already have.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {user ? (
            <Button asChild>
              <Link href="/protected">Open the protected page</Link>
            </Button>
          ) : (
            <>
              {/* Sign up first: a fresh local backend has no accounts in it. */}
              <Button asChild>
                <Link href={signUpLink}>Sign up</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={signInLink}>Sign in</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
