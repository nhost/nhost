import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { updateDisplayName } from '@/screens/account/actions';
import { colors, fontSize } from '@/theme';

/** The display name as the profile shows it, editable in place. */
export default function DisplayNameField({
  displayName,
}: {
  displayName: string;
}) {
  const refresh = useRefresh();
  const toast = useToast();
  const nameId = useId();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const stopEditing = (): void => {
    setEditing(false);
    setError(undefined);
    // Back to what the screen was given, so a cancelled edit leaves nothing
    // behind the next time this opens.
    setName(displayName);
  };

  const handleSubmit = async (): Promise<void> => {
    if (isPending) {
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      const result = await updateDisplayName(name);
      if (result.error) {
        setError(result.error);
        return;
      }

      setEditing(false);
      toast('Name saved');
      // The name shown here comes from the auth service, so the screen is
      // loaded again rather than patched.
      refresh();
    } catch (err) {
      console.error('Error saving the display name:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  if (!editing) {
    return (
      <View style={styles.shown}>
        {/* Wraps rather than truncates: the name is what the card is for. */}
        <Text style={styles.name}>{displayName}</Text>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit name"
          hitSlop={8}
          style={styles.edit}
          onPress={() => setEditing(true)}
        >
          <Svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.mutedForeground}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M12 20h9" />
            <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </Svg>
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {/* The name is right here when the form is closed, so the label is for
          a screen reader rather than for the eye. */}
      <Label nativeID={nameId} style={styles.hidden}>
        Display name
      </Label>
      <Input
        aria-labelledby={nameId}
        autoComplete="name"
        textContentType="name"
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        value={name}
        onChangeText={setName}
        onSubmitEditing={() => void handleSubmit()}
        editable={!isPending}
        style={styles.input}
      />
      <View style={styles.buttons}>
        <Button
          title={isPending ? 'Saving…' : 'Save'}
          size="sm"
          disabled={isPending}
          onPress={() => void handleSubmit()}
        />
        <Button
          title="Cancel"
          variant="outline"
          size="sm"
          disabled={isPending}
          onPress={stopEditing}
        />
      </View>

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    flexShrink: 1,
    color: colors.foreground,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  edit: {
    width: 28,
    height: 28,
  },
  form: {
    gap: 8,
  },
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  input: {
    minHeight: 32,
    paddingVertical: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
