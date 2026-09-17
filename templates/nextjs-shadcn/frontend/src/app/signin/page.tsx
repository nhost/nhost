import { SIGN_IN_DESCRIPTION, SIGN_IN_TITLE } from '@/app/signin/copy';
import { signInDestination } from '@/app/signin/destination';
import SignInForm from '@/app/signin/SignInForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/**
 * `/signin` on its own: a direct load, a refresh, a shared link, or the
 * redirect a protected page issues. Arriving from inside the app gets the
 * modal in `@modal/(.)signin` instead, off the same URL and the same form.
 */
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{SIGN_IN_TITLE}</CardTitle>
          <CardDescription>{SIGN_IN_DESCRIPTION}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm next={signInDestination(next)} />
        </CardContent>
      </Card>
    </div>
  );
}
