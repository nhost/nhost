import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { colors, fontSize } from '@/theme';
import { sendMagicLink } from './actions';

export default function MagicLinkForm({ next }: { next: string }) {
  const emailId = useId();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (isSending || !email) {
      return;
    }
    setError(undefined);
    setIsSending(true);
    try {
      const result = await sendMagicLink(email, next);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setSent(true);
    } catch (err) {
      console.error('Error sending the magic link:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsSending(false);
    }
  };

  const changeAddress = (): void => {
    setSent(false);
    setEmail('');
    setError(undefined);
  };

  if (sent) {
    return (
      <View style={styles.form}>
        <Text style={styles.sent}>
          A sign-in link is on its way to {email}. Open it on this device to
          sign in here.
        </Text>
        <Button
          title="Use a different address"
          variant="ghost"
          size="sm"
          onPress={changeAddress}
          style={styles.change}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Label nativeID={emailId}>Email</Label>
        <Input
          aria-labelledby={emailId}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          inputMode="email"
          textContentType="emailAddress"
          returnKeyType="send"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => void handleSubmit()}
          editable={!isSending}
        />
      </View>

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Button
        title={isSending ? 'Sending…' : 'Send me a link'}
        disabled={isSending || !email}
        onPress={() => void handleSubmit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  sent: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  change: {
    alignSelf: 'center',
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
