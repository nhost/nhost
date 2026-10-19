'use client';

import { type FormEvent, useId, useState } from 'react';
import { changePassword } from '@/app/account/actions';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ChangePasswordForm() {
  const passwordId = useId();
  const confirmId = useId();
  const rulesId = useId();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setDone(false);

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setIsPending(true);
    try {
      const result = await changePassword(password);
      if (result.error) {
        setError(result.error);
        return;
      }

      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      console.error('Error changing the password:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {/* Stacked, not paired. They sat side by side when this was a section
          on the account page, which was wide; on a card of its own there is
          not the width for two, and the reset form a visitor may have met
          first asks for the same two in a column. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>New password</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          aria-describedby={rulesId}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={confirmId}>Confirm new password</Label>
        <Input
          id={confirmId}
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={isPending}
          aria-describedby={rulesId}
        />
      </div>

      <PasswordRequirements
        id={rulesId}
        password={password}
        confirm={confirm}
      />

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {done ? (
        <p role="status" className="text-muted-foreground text-sm">
          Password changed.
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="self-center">
        {isPending ? 'Changing…' : 'Change password'}
      </Button>
    </form>
  );
}
