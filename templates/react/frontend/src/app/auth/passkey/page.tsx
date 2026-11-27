import { useSearchParams } from 'react-router';
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

export default function Passkey() {
  const [searchParams] = useSearchParams();
  const destination = signInDestination(searchParams.get('next') ?? undefined);
  const chosen = signInIntent(searchParams.get('intent') ?? undefined);
  const query = signInQuery(destination, chosen);

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Passkey</CardTitle>
          <CardDescription>
            Touch ID, Windows Hello, or a security key. Nothing to remember.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PasskeyForm next={destination} intent={chosen} />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
