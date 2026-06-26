import { redirect } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Protected() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>You are signed in</CardTitle>
          <CardDescription>
            This page is rendered on the server and redirects to{' '}
            <code>/signin</code> when there is no session.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email: </span>
            {session.user?.email ?? 'Not available'}
          </div>
          <div>
            <span className="text-muted-foreground">User ID: </span>
            {session.user?.id ?? 'Not available'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
