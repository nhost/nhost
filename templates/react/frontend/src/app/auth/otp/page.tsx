import { useSearchParams } from 'react-router';
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
import OtpForm from './OtpForm';

export default function OtpSignIn() {
  const [searchParams] = useSearchParams();
  // Opens the form on the code step for this address (see `link.ts`). It is
  // only ever shown, and "Use a different address" replaces it, so a crafted
  // one does nothing.
  const sentTo = searchParams.get('email')?.trim() || undefined;
  const destination = signInDestination(searchParams.get('next') ?? undefined);
  const query = signInQuery(
    destination,
    signInIntent(searchParams.get('intent') ?? undefined),
  );

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
          <OtpForm next={destination} sentTo={sentTo} />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
