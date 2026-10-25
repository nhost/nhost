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
import { DialogClose, DialogFooter, useCloseDialog } from '@/components/Dialog';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const NETWORK_ERROR = 'The request did not reach the server. Try again.';

export default function ManagePasskeys({ keys }: { keys: Passkey[] }) {
  const router = useRouter();
  const toast = useToast();
  const close = useCloseDialog();
  const nicknameId = useId();

  const [nickname, setNickname] = useState('');
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

      console.error('Error adding a passkey:', err);
      setError('The passkey could not be added. Try again.');
    } finally {
      setPending(undefined);
    }
  };

  // Stays open after a removal, with the list re-read under it, in case
  // there is another to remove.
  const handleRemove = async (id: string): Promise<void> => {
    setError(undefined);
    setPending(id);
    try {
      const result = await removePasskey(id);
      if (result.error) {
        setError(result.error);
        return;
      }

      toast('Passkey removed');
      router.refresh();
    } catch (err) {
      console.error('Error removing a passkey:', err);
      setError(NETWORK_ERROR);
    } finally {
      setPending(undefined);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleAdd}>
      {keys.length === 0 ? null : (
        <ul className="divide-y rounded-lg border">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-4 py-2 pr-2 pl-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {key.nickname || (
                  <span className="font-mono text-xs">
                    {key.credentialId.slice(0, 16)}…
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={Boolean(pending)}
                onClick={() => void handleRemove(key.id)}
              >
                {pending === key.id ? 'Removing…' : 'Remove'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={nicknameId}>
          {keys.length === 0 ? 'Name' : 'Name for a new passkey'}
        </Label>
        <Input
          id={nicknameId}
          type="text"
          autoComplete="off"
          placeholder="This laptop"
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
