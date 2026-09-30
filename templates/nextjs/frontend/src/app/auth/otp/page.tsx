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
import OtpForm from './OtpForm';

export const dynamic = 'force-dynamic';

export default async function OtpSignIn({
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
          <CardTitle>Email code</CardTitle>
          <CardDescription>
            We email you a one-time code and you type it in here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <OtpForm next={destination} mailboxURL={localMailboxURL()} />
          <Link
            href="/signin"
            className="text-muted-foreground text-sm underline underline-offset-4"
          >
            Other ways to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
