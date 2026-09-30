import Link from 'next/link';
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

export default async function Home() {
  const nhost = await createNhostClient();
  const user = nhost.getUserSession()?.user;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>
            {user ? 'You are signed in' : 'You are signed out'}
          </CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email ?? user.id}.`
              : 'Pick a sign-in method to get a session.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {user ? (
            <Button asChild>
              <Link href="/protected">Open the protected page</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
