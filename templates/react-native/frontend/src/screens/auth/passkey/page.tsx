import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import NotFound from '@/components/NotFound';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { passkeyDomain } from '@/lib/nhost/env';
import type { SearchParam } from '@/lib/utils';
import PasskeyForm from '@/screens/auth/passkey/PasskeyForm';
import { signInDestination } from '@/screens/signin/destination';
import { signInIntent } from '@/screens/signin/intent';
import OtherWaysLink from '@/screens/signin/OtherWaysLink';
import { signInQuery } from '@/screens/signin/query';

export default function PasskeySignIn() {
  const params = useLocalSearchParams<{
    next?: SearchParam;
    intent?: SearchParam;
  }>();
  const destination = signInDestination(params.next);
  const chosen = signInIntent(params.intent);
  const query = signInQuery(destination, chosen);

  // Off, as in the sign-in list, until passkeys have a domain to belong to.
  if (!passkeyDomain()) {
    return <NotFound />;
  }

  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>Passkey</CardTitle>
        <CardDescription>
          Face ID, your fingerprint or a security key. Nothing to remember.
        </CardDescription>
      </CardHeader>
      <CardContent style={styles.content}>
        <PasskeyForm next={destination} intent={chosen} />
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
