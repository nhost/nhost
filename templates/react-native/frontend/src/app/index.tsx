import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { useGo } from '@/lib/navigation';
import { useAuth } from '@/lib/nhost/AuthProvider';

export default function Home() {
  const { session } = useAuth();
  const go = useGo();
  const user = session?.user;

  return (
    <Screen>
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
        <CardContent>
          {user ? (
            <Button onPress={() => go.push('/protected')}>
              Open the protected screen
            </Button>
          ) : (
            <>
              {/* Sign up first: a fresh local backend has no accounts in it. */}
              <Button onPress={() => go.push('/signin')}>Sign up</Button>
              <Button
                variant="outline"
                onPress={() =>
                  go.push({
                    pathname: '/signin',
                    params: { intent: 'sign-in' },
                  })
                }
              >
                Sign in
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Screen>
  );
}
