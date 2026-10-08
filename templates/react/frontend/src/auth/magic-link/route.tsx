import MagicLinkForm from '@/auth/magic-link/MagicLinkForm';
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

/**
 * Magic link sign-in. The page only sends the email: the link in it goes to
 * the auth service, which signs the visitor in and redirects back to `next`
 * with a refresh token `lib/nhost/linkToken.ts` redeems on arrival.
 */
export default function MagicLinkPage() {
  const next = useNext();
  const intent = useIntent();
  const query = signInQuery(next, intent);

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
          <MagicLinkForm next={next} mailboxURL={localMailboxURL()} />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
