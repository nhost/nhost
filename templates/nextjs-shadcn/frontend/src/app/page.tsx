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

async function checkConnectivity(): Promise<boolean> {
  try {
    const nhost = await createNhostClient();
    await nhost.graphql.request({ query: '{ __typename }' });
    return true;
  } catch (err) {
    console.error('Could not reach the Nhost GraphQL API:', err);
    return false;
  }
}

export default async function Home() {
  const connected = await checkConnectivity();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Nhost + Next.js + shadcn/ui
        </h1>
        <p className="text-muted-foreground">
          A full-stack starter. The backend (auth, database and GraphQL API)
          lives in <code>backend/</code>; this app lives in{' '}
          <code>frontend/</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {connected
              ? 'Connected to Nhost GraphQL ✓'
              : 'Backend not reachable'}
          </CardTitle>
          <CardDescription>
            {connected
              ? 'The frontend successfully reached your GraphQL API.'
              : 'Start the local backend with `cd backend && nhost up`, then reload this page.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Try authentication</CardTitle>
            <CardDescription>
              Sign in with an email one-time code. While running locally, the
              email with the code is captured by the local mail viewer.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/protected">Protected page</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Try typed data</CardTitle>
            <CardDescription>
              The starter includes a per-user <code>todos</code> table with a
              typed query and mutation. Sign in, open the protected page, and
              add a todo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
