import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listPasskeys } from '@/app/auth/passkey/manage/actions';
import ManagePasskeys from '@/app/auth/passkey/manage/ManagePasskeys';
import { signInHref } from '@/app/signin/destination';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getVerifiedUser } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// Guards itself rather than being listed in the proxy's protected routes: that
// list is shared code, and shared code never names a method.
export default async function Manage() {
  const user = await getVerifiedUser();

  if (!user) {
    redirect(signInHref('/auth/passkey/manage'));
  }

  const { keys, error } = await listPasskeys();

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            The passkeys that can sign in to this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : (
            <ManagePasskeys keys={keys ?? []} />
          )}
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto self-center p-0"
          >
            <Link href="/account">Back to your account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
