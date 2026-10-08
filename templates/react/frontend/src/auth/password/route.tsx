import PasswordForm from '@/auth/password/PasswordForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { localMailboxURL } from '@/lib/nhost/env';
import OtherWaysLink from '@/signin/OtherWaysLink';
import { signInQuery } from '@/signin/query';
import { useIntent } from '@/signin/useIntent';
import { useNext } from '@/signin/useNext';

export default function PasswordPage() {
  const next = useNext();
  const intent = useIntent();
  const query = signInQuery(next, intent);

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
            next={next}
            intent={intent}
            mailboxURL={localMailboxURL()}
          />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
