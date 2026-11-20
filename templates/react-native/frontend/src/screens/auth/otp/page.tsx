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
import { signInDestination } from '@/screens/signin/destination';
import { signInIntent } from '@/screens/signin/intent';
import OtherWaysLink from '@/screens/signin/OtherWaysLink';
import { signInQuery } from '@/screens/signin/query';
import OtpForm from './OtpForm';

export default function OtpSignIn() {
  const params = useLocalSearchParams<{
    next?: SearchParam;
    intent?: SearchParam;
  }>();
  const destination = signInDestination(params.next);
  const query = signInQuery(destination, signInIntent(params.intent));

  return (
    <Card style={styles.card}>
      <CardHeader>
        <CardTitle>Email code</CardTitle>
        <CardDescription>
          We email you a one-time code and you type it in here.
        </CardDescription>
      </CardHeader>
      <CardContent style={styles.content}>
        <OtpForm next={destination} />
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
