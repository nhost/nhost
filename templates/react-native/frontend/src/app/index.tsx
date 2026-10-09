import { ActivityIndicator, View } from 'react-native';
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
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { signInRoute } from '@/signin/route';

export default function Home() {
  const { session, isLoading } = useAuth();
  const go = useGo();
  const user = session?.user;

  // Every launch lands here, and so does a link that names nowhere else, whose
  // redemption is a round trip to the server. Until that is done the
  // signed-out card would be wrong for someone being signed in, and a blank
  // screen would look stuck, so the frame stays up with a spinner.
  if (isLoading) {
    return (
      <Screen>
        <View className="items-center py-12">
          <ActivityIndicator
            accessibilityLabel="Checking whether you are signed in"
            color="#171717"
          />
        </View>
      </Screen>
    );
  }

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
              <Button
                onPress={() =>
                  go.push(
                    signInRoute('/signin', DEFAULT_DESTINATION, 'sign-up'),
                  )
                }
              >
                Sign up
              </Button>
              <Button
                variant="outline"
                onPress={() =>
                  go.push(
                    signInRoute('/signin', DEFAULT_DESTINATION, 'sign-in'),
                  )
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
