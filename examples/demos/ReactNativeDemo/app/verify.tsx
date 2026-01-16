import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from './lib/nhost/AuthProvider';

export default function Verify() {
  const params = useLocalSearchParams<{ refreshToken: string }>();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    'verifying',
  );
  const [error, setError] = useState<string>('');

  const { nhost, isAuthenticated } = useAuth();

  useEffect(() => {
    const refreshToken = params.refreshToken;

    if (!refreshToken) {
      setStatus('error');
      setError('No refresh token found in the link');
      return;
    }

    // Flag to handle component unmounting during async operations
    let isMounted = true;

    async function processToken(): Promise<void> {
      try {
        // First display the verifying message for at least a moment
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!isMounted) return;

        if (!refreshToken) {
          // Collect all URL parameters to display
          const allParams: Record<string, string> = {};
          Object.entries(params).forEach(([key, value]) => {
            if (typeof value === 'string') {
              allParams[key] = value;
            }
          });

          setStatus('error');
          setError('No refresh token found in the link');
          return;
        }

        // Process the token
        await nhost.auth.refreshToken({ refreshToken });

        if (!isMounted) return;

        setStatus('success');

        // Wait to show success message briefly, then redirect
        setTimeout(() => {
          if (isMounted) router.replace('/profile');
        }, 1500);
      } catch (err) {
        if (!isMounted) return;

        const errMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred';

        setStatus('error');
        setError(`An error occurred during verification: ${errMessage}`);
      }
    }

    void processToken();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [params, nhost.auth]);

  // If already authenticated and not handling verification, redirect to profile
  useEffect(() => {
    if (isAuthenticated && status !== 'verifying') {
      router.replace('/profile');
    }
  }, [isAuthenticated, status]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nhost SDK Demo</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Email Verification</Text>

        <View style={styles.contentContainer}>
          {status === 'verifying' && (
            <View>
              <Text style={styles.statusText}>Verifying your email...</Text>
              <ActivityIndicator
                size="large"
                color="#6366f1"
                style={styles.spinner}
              />
            </View>
          )}

          {status === 'success' && (
            <View>
              <Text style={styles.successText}>✓ Successfully verified!</Text>
              <Text style={styles.statusText}>
                You&apos;ll be redirected to your profile page shortly...
              </Text>
            </View>
          )}

          {status === 'error' && (
            <View>
              <Text style={styles.errorText}>Verification failed</Text>
              <Text style={styles.statusText}>{error}</Text>

              <View style={styles.debugInfo}>
                <Text style={styles.debugTitle}>Testing in Expo Go?</Text>
                <Text style={styles.debugText}>
                  Make sure your magic link uses the proper Expo Go format.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.replace('/signin')}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  debugInfo: {
    backgroundColor: '#fff8dc',
    padding: 10,
    borderRadius: 5,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#b8860b',
  },
  debugText: {
    color: '#5a4a00',
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    color: '#4a5568',
  },
  spinner: {
    marginVertical: 20,
  },
  successText: {
    color: '#38a169',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  paramsContainer: {
    backgroundColor: '#f7fafc',
    borderRadius: 5,
    padding: 10,
    marginVertical: 15,
    width: '100%',
    maxHeight: 150,
  },
  paramsTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2d3748',
  },
  paramRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  paramKey: {
    color: '#4299e1',
    marginRight: 5,
    fontFamily: 'monospace',
  },
  paramValue: {
    flex: 1,
    fontFamily: 'monospace',
    color: '#2d3748',
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 15,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
