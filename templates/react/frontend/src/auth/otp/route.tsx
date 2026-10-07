import { Link } from 'react-router';
import OtpForm from '@/auth/otp/OtpForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { localMailboxURL } from '@/lib/nhost/env';
import { useNext } from '@/signin/useNext';

export default function OtpPage() {
  const next = useNext();

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
          <Link
            to="/signin"
            className="text-muted-foreground text-sm underline underline-offset-4"
          >
            Other ways to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
