import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DialogClose, DialogFooter, useCloseDialog } from '@/components/Dialog';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRefresh } from '@/components/useRefresh';
import { useRemoved } from '@/components/useRemoved';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import {
  alreadyRegistered,
  wasCancelled,
} from '@/screens/auth/passkey/cancelled';
import {
  startRegistration,
  supportsPasskeys,
} from '@/screens/auth/passkey/ceremony';
import {
  beginAddPasskey,
  finishAddPasskey,
  type Passkey,
  removePasskey,
} from '@/screens/auth/passkey/manage/actions';
import {
  deviceName,
  passkeyName,
  unusedName,
} from '@/screens/auth/passkey/manage/names';
import {
  forgetPasskey,
  passkeysOnThisDevice,
  rememberPasskey,
} from '@/screens/auth/passkey/thisDevice';
import { colors, fontSize, radius } from '@/theme';

const ANOTHER_DEVICE = 'To add another, use another device or a security key.';

export default function ManagePasskeys({ keys: listed }: { keys: Passkey[] }) {
  const refresh = useRefresh();
  const toast = useToast();
  const close = useCloseDialog();
  const nicknameId = useId();

  // Gone from the list as soon as Remove is pressed, rather than once the
  // refreshed screen arrives (see `useRemoved`).
  const { removed, remove, restore } = useRemoved();
  const keys = listed.filter((key) => !removed.has(key.id));

  const [onThisDevice, setOnThisDevice] = useState(passkeysOnThisDevice);

  // The device would refuse a second passkey for this account (see
  // `alreadyRegistered`), so the dialog says so before Add is pressed.
  const here = keys.find((key) => onThisDevice.has(key.credentialId));

  // Starts as the device it is added on, numbered past any passkey already
  // called that, for the user to keep or change; blank when this device has
  // one, since the next has to come from another.
  const [nickname, setNickname] = useState(() => {
    const device = deviceName();
    return device && !here
      ? unusedName(
          device,
          keys.map((key) => key.nickname),
        )
      : '';
  });
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState<string | undefined>();

  const handleAdd = async (): Promise<void> => {
    if (pending) {
      return;
    }
    setError(undefined);

    if (!supportsPasskeys()) {
      setError('This device does not support passkeys.');
      return;
    }

    setPending('add');
    try {
      const begun = await beginAddPasskey();
      if (begun.error || !begun.options) {
        setError(begun.error ?? 'Could not start adding a passkey.');
        return;
      }

      const credential = await startRegistration(begun.options);
      const result = await finishAddPasskey(credential, nickname);
      if (result.error) {
        setError(result.error);
        return;
      }
      rememberPasskey(credential.id);

      // Adding is what the dialog was opened for, so it closes.
      close();
      toast('Passkey added');
      refresh();
    } catch (err) {
      if (wasCancelled(err)) {
        setError('The passkey prompt was cancelled.');
        return;
      }

      if (alreadyRegistered(err)) {
        setError(
          `This device already has a passkey for your account. ${ANOTHER_DEVICE}`,
        );
        return;
      }

      console.error('Error adding a passkey:', err);
      setError('The passkey could not be added. Try again.');
    } finally {
      setPending(undefined);
    }
  };

  // Stays open after a removal, with the list read again under it, in case
  // there is another to remove.
  const handleRemove = async (key: Passkey): Promise<void> => {
    setError(undefined);
    remove(key.id);
    try {
      const result = await removePasskey(key.id);
      if (result.error) {
        restore(key.id);
        setError(result.error);
        return;
      }

      forgetPasskey(key.credentialId);
      setOnThisDevice(passkeysOnThisDevice());
      toast('Passkey removed');
      refresh();
    } catch (err) {
      console.error('Error removing a passkey:', err);
      restore(key.id);
      setError(NETWORK_ERROR);
    }
  };

  return (
    <View style={styles.form}>
      {keys.length === 0 ? null : (
        <View style={styles.list}>
          {keys.map((key, index) => (
            <View
              key={key.id}
              style={[styles.row, index > 0 && styles.rowLine]}
            >
              <View style={styles.name}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {passkeyName(key, index)}
                </Text>
                {key === here ? (
                  <Text style={styles.badge}>This device</Text>
                ) : null}
              </View>
              <Button
                title="Remove"
                variant="ghost"
                size="sm"
                labelStyle={styles.destructive}
                disabled={pending === 'add'}
                onPress={() => void handleRemove(key)}
              />
            </View>
          ))}
        </View>
      )}

      {here ? (
        <Text style={styles.muted}>
          This device already has a passkey for your account. {ANOTHER_DEVICE}
        </Text>
      ) : null}

      <View style={styles.field}>
        <Label nativeID={nicknameId}>
          {keys.length === 0 ? 'Name' : 'Name for a new passkey'}
        </Label>
        <Input
          aria-labelledby={nicknameId}
          autoComplete="off"
          autoCorrect={false}
          placeholder={here ? 'My laptop' : 'This phone'}
          returnKeyType="done"
          value={nickname}
          onChangeText={setNickname}
          onSubmitEditing={() => void handleAdd()}
          editable={!pending}
        />
      </View>

      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <DialogFooter>
        <DialogClose
          disabled={pending === 'add'}
          title={keys.length === 0 ? 'Cancel' : 'Done'}
        />
        <Button
          title={pending === 'add' ? 'Waiting for your device…' : 'Add passkey'}
          size="sm"
          disabled={Boolean(pending)}
          onPress={() => void handleAdd()}
        />
      </DialogFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 4,
  },
  rowLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  name: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    flexShrink: 1,
    color: colors.foreground,
    fontSize: fontSize.sm,
  },
  badge: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    color: colors.foreground,
    fontSize: fontSize.xs,
  },
  destructive: {
    color: colors.destructive,
  },
  field: {
    gap: 8,
  },
  muted: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
