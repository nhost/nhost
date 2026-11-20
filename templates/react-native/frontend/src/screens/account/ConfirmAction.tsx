import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { colors, fontSize } from '@/theme';

/** The answers to a dialog that asks before it acts. */
export default function ConfirmAction({
  confirm,
  pending: pendingLabel,
  cancel = 'Cancel',
  destructive = false,
  typeToConfirm,
  onConfirm,
}: {
  confirm: string;
  pending: string;
  cancel?: string;
  destructive?: boolean;
  typeToConfirm?: string;
  /** Resolves to an error to show, or to nothing once it has acted. */
  onConfirm: () => Promise<string | undefined>;
}) {
  const typedId = useId();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const confirmed = !typeToConfirm || typed.trim() === typeToConfirm;

  const handleConfirm = async (): Promise<void> => {
    if (!confirmed || pending) {
      return;
    }

    setError(undefined);
    setPending(true);
    try {
      setError(await onConfirm());
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.form}>
      {typeToConfirm ? (
        <View style={styles.field}>
          <Label nativeID={typedId} style={styles.label}>
            Type <Text style={styles.word}>{typeToConfirm}</Text> to confirm
          </Label>
          <Input
            aria-labelledby={typedId}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={() => void handleConfirm()}
            editable={!pending}
          />
        </View>
      ) : null}

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <DialogFooter>
        <DialogClose title={cancel} disabled={pending} />
        <Button
          title={pending ? pendingLabel : confirm}
          size="sm"
          variant={destructive ? 'destructive' : 'default'}
          disabled={pending || !confirmed}
          onPress={() => void handleConfirm()}
        />
      </DialogFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontWeight: '400',
  },
  word: {
    fontWeight: '600',
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
