import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { SearchParam } from '@/lib/utils';
import PasswordForm from '@/screens/auth/password/PasswordForm';
import { signInDestination } from '@/screens/signin/destination';
import { signInIntent } from '@/screens/signin/intent';
import OtherWaysLink from '@/screens/signin/OtherWaysLink';
import { signInQuery } from '@/screens/signin/query';

export default function Password() {
  const params = useLocalSearchParams<{
    next?: SearchParam;
    intent?: SearchParam;
  }>();
  const destination = signInDestination(params.next);
  const chosen = signInIntent(params.intent);
  const query = signInQuery(destination, chosen);

  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>Email and password</CardTitle>
        <CardDescription>
          Sign in, or sign up and confirm your address by email.
        </CardDescription>
      </CardHeader>
      <CardContent style={styles.content}>
        <PasswordForm next={destination} intent={chosen} />
        <OtherWaysLink query={query} />
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
  content: {
    gap: 16,
  },
});
