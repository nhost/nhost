import PasskeyForm from '@/app/auth/passkey/PasskeyForm';
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

export default async function Passkey({
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
          <CardTitle>Passkey</CardTitle>
          <CardDescription>
            Touch ID, Windows Hello, or a security key. Nothing to remember.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PasskeyForm
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
