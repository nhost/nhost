'use client';

import {
  browserSupportsWebAuthn,
  startRegistration,
} from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { wasCancelled } from '@/app/auth/passkey/cancelled';
import {
  beginAddPasskey,
  finishAddPasskey,
  type Passkey,
  removePasskey,
} from '@/app/auth/passkey/manage/actions';
import {
  deviceName,
  passkeyName,
  unusedName,
} from '@/app/auth/passkey/manage/names';
import {
  alreadyRegistered,
  forgetPasskey,
  passkeysOnThisDevice,
  rememberPasskey,
} from '@/app/auth/passkey/thisDevice';
import { DialogClose, DialogFooter, useCloseDialog } from '@/components/Dialog';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRemoved } from '@/components/useRemoved';

const NETWORK_ERROR = 'The request did not reach the server. Try again.';
const ANOTHER_DEVICE = 'To add another, use your phone or a security key.';

export default function ManagePasskeys({ keys: listed }: { keys: Passkey[] }) {
  const router = useRouter();
  const toast = useToast();
  const close = useCloseDialog();
  const nicknameId = useId();

  // Gone from the list as soon as Remove is pressed, rather than once the
  // refreshed page arrives (see `useRemoved`).
  const { removed, remove, restore } = useRemoved();
  const keys = listed.filter((key) => !removed.has(key.id));

  const [onThisDevice, setOnThisDevice] = useState(passkeysOnThisDevice);

  // The device would refuse a second passkey for this account (see
  // `alreadyRegistered`), so the dialog says so before Add is pressed.
  const here = keys.find((key) => onThisDevice.has(key.credentialId));

  // Starts as the device it is added on, numbered past any passkey already
  // called that, for the user to keep or change; blank when this device has
  // one, since the next has to come from another. The dialog's contents only
  // render in the browser, once it is opened, so `navigator` is there.
  const [nickname, setNickname] = useState(() => {
    const device = deviceName(navigator.userAgent);
    return device && !here
      ? unusedName(
          device,
          keys.map((key) => key.nickname),
        )
      : '';
  });
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState<string | undefined>();

  const handleAdd = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);

    if (!browserSupportsWebAuthn()) {
      setError('This browser does not support passkeys.');
      return;
    }

    setPending('add');
    try {
      const begun = await beginAddPasskey();
      if (begun.error || !begun.options) {
        setError(begun.error ?? 'Could not start adding a passkey.');
        return;
      }

      const credential = await startRegistration({
        optionsJSON: begun.options,
      });
      const result = await finishAddPasskey(credential, nickname);
      if (result.error) {
        setError(result.error);
        return;
      }
      rememberPasskey(credential.id);

      // Adding is what the dialog was opened for, so it closes. The page
      // reads the list from the backend, so it is re-rendered rather than
      // patched here.
      close();
      toast('Passkey added');
      router.refresh();
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

  // Stays open after a removal, with the list re-read under it, in case
  // there is another to remove. The passkey leaves the list at once and comes
  // back only if the server refused.
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
      router.refresh();
    } catch (err) {
      console.error('Error removing a passkey:', err);
      restore(key.id);
      setError(NETWORK_ERROR);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleAdd}>
      {keys.length === 0 ? null : (
        <ul className="divide-y rounded-lg border">
          {keys.map((key, index) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-4 py-2 pr-2 pl-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate">
                  {passkeyName(key, index)}
                </span>
                {key === here ? (
                  <span className="shrink-0 whitespace-nowrap rounded-full border bg-secondary px-2 text-xs">
                    This device
                  </span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={pending === 'add'}
                onClick={() => void handleRemove(key)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {here ? (
        <p className="text-muted-foreground text-sm">
          This browser already has a passkey for your account. {ANOTHER_DEVICE}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={nicknameId}>
          {keys.length === 0 ? 'Name' : 'Name for a new passkey'}
        </Label>
        <Input
          id={nicknameId}
          type="text"
          autoComplete="off"
          placeholder={here ? 'My phone' : 'This laptop'}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          disabled={Boolean(pending)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose disabled={pending === 'add'}>
          {keys.length === 0 ? 'Cancel' : 'Done'}
        </DialogClose>
        <Button type="submit" size="sm" disabled={Boolean(pending)}>
          {pending === 'add' ? 'Waiting for your device…' : 'Add passkey'}
        </Button>
      </DialogFooter>
    </form>
  );
}
