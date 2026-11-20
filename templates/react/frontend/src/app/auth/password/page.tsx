import { useSearchParams } from 'react-router';
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

export default function Password() {
  const [searchParams] = useSearchParams();
  const destination = signInDestination(searchParams.get('next') ?? undefined);
  const chosen = signInIntent(searchParams.get('intent') ?? undefined);
  const query = signInQuery(destination, chosen);

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Email and password</CardTitle>
          <CardDescription>
            Sign in, or sign up and confirm your address by email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PasswordForm next={destination} intent={chosen} />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
