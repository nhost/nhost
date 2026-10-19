import Link from 'next/link';
import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;

export default async function Home() {
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        {/* The buttons are a CardAction, which puts them on the heading's
            row. Under it they left the whole right of the card empty. */}
        <CardHeader>
          <CardTitle>
            {user ? 'You are signed in' : 'You are not signed in'}
          </CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email ?? user.id}.`
              : 'Create an account, or sign in to one you already have.'}
          </CardDescription>
          <CardAction className="flex gap-2 self-center">
            {user ? (
              <Button asChild>
                <Link href="/account">Go to your account</Link>
              </Button>
            ) : (
              <>
                {/* Sign up first: a fresh local backend has no accounts. */}
                <Button asChild>
                  <Link href={signUpLink}>Sign up</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={signInLink}>Sign in</Link>
                </Button>
              </>
            )}
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  );
}
