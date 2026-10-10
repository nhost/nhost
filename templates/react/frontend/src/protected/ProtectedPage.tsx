import { Navigate } from 'react-router';
import SignOutButton from '@/components/SignOutButton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { signInHref } from '@/signin/destination';

export default function ProtectedPage() {
  const { session, isLoading } = useAuth();

  // Nothing is decided until a token on the URL has been redeemed, or a
  // visitor arriving from a link with `next=/protected` would be bounced to
  // sign-in while the link was signing them in.
  if (isLoading) {
    return null;
  }

  // This is a convenience, not a control. The check runs in the browser, so
  // anyone can reach this component's markup by editing their own copy of the
  // app. What protects data is the backend's permissions: the access token is
  // what the API checks, and a request without a valid one gets nothing back
  // no matter what this page renders.
  const user = session?.user;

  if (!user) {
    return <Navigate replace to={signInHref('/protected')} />;
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Protected</CardTitle>
          <CardDescription>
            Only a signed-in visitor gets this far.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email ?? '—'}</dd>
            <dt className="text-muted-foreground">User id</dt>
            <dd className="font-mono text-xs">{user.id}</dd>
          </dl>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
