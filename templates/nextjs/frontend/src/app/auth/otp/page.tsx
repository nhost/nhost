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
import OtpForm from './OtpForm';

export const dynamic = 'force-dynamic';

export default async function OtpSignIn({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    intent?: string | string[];
    email?: string | string[];
  }>;
}) {
  const { next, intent, email } = await searchParams;
  // Set by the link in the code email (see `link.ts`). It is only ever shown,
  // and "Use a different address" replaces it, so a crafted one does nothing.
  const sentTo = (Array.isArray(email) ? email[0] : email)?.trim() || undefined;
  const destination = signInDestination(next);
  const query = signInQuery(destination, signInIntent(intent));

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Email code</CardTitle>
          <CardDescription>
            We email you a one-time code and you type it in here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <OtpForm
            next={destination}
            sentTo={sentTo}
            mailboxURL={localMailboxURL()}
          />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
