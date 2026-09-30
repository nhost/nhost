import Link from 'next/link';
import PasswordForm from '@/app/auth/password/PasswordForm';
import { signInDestination } from '@/app/signin/destination';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function Password({
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
          <CardTitle>Email and password</CardTitle>
          <CardDescription>
            Sign in, or sign up and confirm your address by email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PasswordForm next={destination} />
          <Link
            href="/signin"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Other ways to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
