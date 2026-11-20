import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSession } from '@/lib/nhost/AuthProvider';
import { passwordSignIn } from '@/screens/auth/password/passwordSignIn';
import ResetPasswordForm from '@/screens/auth/password/reset/ResetPasswordForm';

// The reset email's link goes through the auth service, which sends the user
// back here with a code `consumeLink` trades only for a signed-out visitor.
export default function ResetPassword() {
  const session = useSession();

  if (!session) {
    return (
      <Card style={styles.card}>
        <CardHeader>
          <CardTitle>This link no longer works</CardTitle>
          <CardDescription>
            It has expired or was already used. Request another one and open it
            on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={passwordSignIn} asChild>
            <Button title="Request a new link" role="link" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          You are signed in as {session.user?.email ?? 'this account'}. Choose a
          new password for this account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
  },
});
