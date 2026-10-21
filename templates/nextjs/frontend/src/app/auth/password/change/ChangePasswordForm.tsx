'use client';

import { type FormEvent, useId, useState } from 'react';
import { changePassword } from '@/app/account/actions';
import PasswordChanged from '@/app/auth/password/PasswordChanged';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements';
import { useReplacePage } from '@/components/ReplacePageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ChangePasswordForm() {
  const replacePage = useReplacePage();
  const passwordId = useId();
  const confirmId = useId();
  const rulesId = useId();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);

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

      replacePage(<PasswordChanged />);
    } catch (err) {
      console.error('Error changing the password:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {/* The two fields and the button in one row: the account row is wide,
          and there is nothing else to fill it with. They stack on a narrow
          screen. items-end lines the button up with the inputs rather than
          with their labels. What changing it costs is said where it is
          done, since nothing on the row says it. */}
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
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

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Changing…' : 'Change password'}
        </Button>
      </div>

      <PasswordRequirements
        id={rulesId}
        password={password}
        confirm={confirm}
        className="flex-row flex-wrap items-start gap-x-4"
      />

      <p className="text-muted-foreground text-sm">
        Changing it signs every session out, this browser included.
      </p>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
