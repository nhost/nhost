import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useAuth } from './lib/nhost/AuthProvider';
import { styles } from './styles';

export default function Home() {
  const { nhost, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    nhost.graphql
      .request({ query: '{ __typename }' })
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
  }, [nhost]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Nhost + Expo</Text>
      <Text style={styles.muted}>
        A full-stack starter. The backend (auth, database and GraphQL API) lives
        in backend/; this app lives in frontend/.
      </Text>

      <View style={styles.card}>
        {connected === null ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.cardTitle}>
            {connected ? 'Connected to Nhost GraphQL' : 'Backend not reachable'}
          </Text>
        )}
        <Text style={styles.muted}>
          {connected
            ? 'The app reached your GraphQL API.'
            : 'Start the local backend with `cd backend && nhost up`, then reload.'}
        </Text>
      </View>

      <Link href="/signin" style={styles.linkButton}>
        Sign in
      </Link>
      <Link href="/protected" style={styles.link}>
        {isAuthenticated ? 'Your todos' : 'Protected page'}
      </Link>
    </ScrollView>
  );
}
