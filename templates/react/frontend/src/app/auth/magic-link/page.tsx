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
import MagicLinkForm from './MagicLinkForm';

/** Magic link sign-in. */
export default function MagicLink() {
  const [searchParams] = useSearchParams();
  const destination = signInDestination(searchParams.get('next') ?? undefined);
  const query = signInQuery(
    destination,
    signInIntent(searchParams.get('intent') ?? undefined),
  );

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
          <MagicLinkForm next={destination} />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
