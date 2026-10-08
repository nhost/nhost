import { Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SignOutButton } from '@/components/SignOutButton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Redirect } from '@/lib/navigation';
import { useAuth } from '@/lib/nhost/AuthProvider';

export default function Protected() {
  const { session, isLoading } = useAuth();

  // Nothing is decided until the stored session has been read off disk and an
  // emailed link has been redeemed, or a user who is signed in, or about to
  // be, would be bounced to sign-in first.
  if (isLoading) {
    return null;
  }

  // This is a convenience, not a control. The check runs on the device, and
  // the bundle is on the user's phone for anyone to unpack and change. What
  // protects data is the backend's permissions: the access token is what the
  // API checks, and a request without a valid one gets nothing back no matter
  // what this screen renders.
  const user = session?.user;

  if (!user) {
    return (
      <Redirect to={{ pathname: '/signin', params: { next: '/protected' } }} />
    );
  }

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle>Protected</CardTitle>
          <CardDescription>
            Only a signed-in user gets this far.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <View className="gap-1">
            <Text className="text-neutral-500 text-sm">Email</Text>
            <Text className="text-neutral-900">{user.email ?? '—'}</Text>
          </View>
          <View className="gap-1">
            <Text className="text-neutral-500 text-sm">User id</Text>
            <Text className="font-mono text-neutral-900 text-xs">
              {user.id}
            </Text>
          </View>
          <SignOutButton />
        </CardContent>
      </Card>
    </Screen>
  );
}
