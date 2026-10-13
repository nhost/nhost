import PasswordForm from '@/app/auth/password/PasswordForm';
import { signInDestination } from '@/app/signin/destination';
import { signInIntent } from '@/app/signin/intent';
import OtherWaysLink from '@/app/signin/OtherWaysLink';
import { signInQuery } from '@/app/signin/query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { localMailboxURL } from '@/lib/nhost/env';

export const dynamic = 'force-dynamic';

export default async function Password({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    intent?: string | string[];
  }>;
}) {
  const { next, intent } = await searchParams;
  const destination = signInDestination(next);
  const chosen = signInIntent(intent);
  const query = signInQuery(destination, chosen);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Email and password</CardTitle>
          <CardDescription>
            Sign in, or sign up and confirm your address by email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PasswordForm
            next={destination}
            intent={chosen}
            mailboxURL={localMailboxURL()}
          />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
