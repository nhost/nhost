import OtpForm from '@/auth/otp/OtpForm';
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

export default function OtpPage() {
  const next = useNext();
  const intent = useIntent();
  const query = signInQuery(next, intent);

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
          <OtpForm next={next} mailboxURL={localMailboxURL()} />
          <OtherWaysLink query={query} />
        </CardContent>
      </Card>
    </div>
  );
}
