import { redirect } from 'next/navigation';
import { signInHref } from '@/app/signin/destination';
import SignOutButton from '@/components/SignOutButton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getVerifiedUser } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Protected() {
  // The proxy only reads the session cookie, which anyone can write, so it
  // redirects the signed-out but proves nothing. This asks the auth service.
  const user = await getVerifiedUser();

  if (!user) {
    redirect(signInHref('/protected'));
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Protected</CardTitle>
          <CardDescription>
            Only a signed-in visitor gets this far.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email ?? '—'}</dd>
            <dt className="text-muted-foreground">User id</dt>
            <dd className="font-mono text-xs">{user.id}</dd>
          </dl>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
