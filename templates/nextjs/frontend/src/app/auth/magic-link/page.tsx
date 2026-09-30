import Link from 'next/link';
import { signInDestination } from '@/app/signin/destination';
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

/**
 * Magic link sign-in. The page only sends the email: the link in it goes to
 * the auth service, which signs the visitor in and redirects back to `next`
 * with a refresh token the proxy redeems on arrival.
 */
export default async function MagicLink({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = signInDestination(next);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Magic link</CardTitle>
          <CardDescription>
            Enter your email and we will send you a link that signs you in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <MagicLinkForm next={destination} mailboxURL={localMailboxURL()} />
          <Link
            href="/signin"
            className="text-muted-foreground text-sm underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Other ways to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
