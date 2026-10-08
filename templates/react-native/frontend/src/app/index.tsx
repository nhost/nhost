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
            {user ? 'You are signed in' : 'You are signed out'}
          </CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email ?? user.id}.`
              : 'Pick a sign-in method to get a session.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onPress={() => go.push(user ? '/protected' : '/signin')}>
            {user ? 'Open the protected screen' : 'Sign in'}
          </Button>
        </CardContent>
      </Card>
    </Screen>
  );
}
