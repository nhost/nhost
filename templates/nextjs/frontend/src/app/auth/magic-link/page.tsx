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
import MagicLinkForm from './MagicLinkForm';

export const dynamic = 'force-dynamic';

/** Magic link sign-in. */
export default async function MagicLink({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    intent?: string | string[];
  }>;
}) {
  const { next, intent } = await searchParams;
  const destination = signInDestination(next);
  const query = signInQuery(destination, signInIntent(intent));

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Magic link</CardTitle>
          <CardDescription>
            Enter your email and we will send you a link that signs you in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <MagicLinkForm next={destination} mailboxURL={localMailboxURL()} />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
