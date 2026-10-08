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
            {user ? 'You are signed in' : 'You are signed out'}
          </CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email ?? user.id}.`
              : 'Pick a sign-in method to get a session.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild>
            <Link to={user ? '/protected' : '/signin'}>
              {user ? 'Open the protected page' : 'Sign in'}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
