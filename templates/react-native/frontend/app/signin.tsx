import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from './lib/nhost/AuthProvider';
import { styles } from './styles';

export default function SignIn() {
  const { nhost } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await nhost.auth.signInOTPEmail({ email });
      setSent(true);
    } catch (err) {
      setError(`Could not send the code: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nhost.auth.verifySignInOTPEmail({ email, otp });
      if (response.body?.session) {
        router.replace('/protected');
      } else {
        setError('Invalid or expired code. Please try again.');
      }
    } catch (err) {
      setError(`Could not verify the code: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.muted}>
        Enter your email and we'll send a one-time code. While running locally,
        the email with the code is captured by the local mail viewer.
      </Text>

      <View style={styles.card}>
        {sent ? (
          <>
            <Text style={styles.label}>Code sent to {email}</Text>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
            />
            <TouchableOpacity
              style={styles.button}
              onPress={verify}
              disabled={loading || !otp}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TouchableOpacity
              style={styles.button}
              onPress={sendCode}
              disabled={loading || !email}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Send code</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}
