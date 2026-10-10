import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { signInQuery } from '@/signin/query';

const signUpLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-up')}`;
const signInLink = `/signin${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;

export default function Home() {
  const { session, isLoading } = useAuth();

  // Auth emails and the OAuth callback land here by default, and until their
  // token is redeemed this page would tell a visitor who is being signed in
  // that they are signed out.
  if (isLoading) {
    return null;
  }

  const user = session?.user;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>
            {user ? 'You are signed in' : 'You are not signed in'}
          </CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email ?? user.id}.`
              : 'Create an account, or sign in to one you already have.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {user ? (
            <Button asChild>
              <Link to="/protected">Open the protected page</Link>
            </Button>
          ) : (
            <>
              {/* Sign up first: a fresh local backend has no accounts in it. */}
              <Button asChild>
                <Link to={signUpLink}>Sign up</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={signInLink}>Sign in</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
