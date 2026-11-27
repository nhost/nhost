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
import { passwordSignIn } from '@/screens/auth/password/passwordSignIn';

export default function PasswordChanged() {
  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>Password changed</CardTitle>
        <CardDescription>
          Changing it signed you out everywhere, this device included. Sign in
          again with the new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={passwordSignIn} asChild>
          <Button title="Sign in" role="link" />
        </Link>
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
