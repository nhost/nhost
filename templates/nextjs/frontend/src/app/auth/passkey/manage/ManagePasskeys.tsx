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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const NETWORK_ERROR = 'The request did not reach the server. Try again.';

export default function ManagePasskeys({ keys }: { keys: Passkey[] }) {
  const router = useRouter();
  const nicknameId = useId();

  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState<string | undefined>();

  // The page reads the list from the backend, so after a change it is
  // re-rendered rather than patched here.
  const finish = (): void => {
    setNickname('');
    router.refresh();
  };

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

      finish();
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

  const handleRemove = async (id: string): Promise<void> => {
    setError(undefined);
    setPending(id);
    try {
      const result = await removePasskey(id);
      if (result.error) {
        setError(result.error);
        return;
      }

      finish();
    } catch (err) {
      console.error('Error removing a passkey:', err);
      setError(NETWORK_ERROR);
    } finally {
      setPending(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {keys.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm">
          No passkeys yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm"
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
                variant="outline"
                size="sm"
                disabled={Boolean(pending)}
                onClick={() => void handleRemove(key.id)}
              >
                {pending === key.id ? 'Removing…' : 'Remove'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleAdd}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={nicknameId}>Name for the new passkey</Label>
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

        <Button
          type="submit"
          disabled={Boolean(pending)}
          className="self-center"
        >
          {pending === 'add' ? 'Waiting for your device…' : 'Add a passkey'}
        </Button>
      </form>
    </div>
  );
}
