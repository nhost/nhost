'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { setNewPassword } from '@/app/auth/password/actions';
import PasswordChanged from '@/app/auth/password/PasswordChanged';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements';
import { useReplacePage } from '@/components/ReplacePageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signOut } from '@/lib/nhost/actions';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

export default function ResetPasswordForm() {
  const router = useRouter();
  const replacePage = useReplacePage();
  const passwordId = useId();
  const confirmId = useId();
  const rulesId = useId();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await setNewPassword(password);
      if (result.error) {
        setError(result.error);
        return;
      }

      replacePage(<PasswordChanged />);
    } catch (err) {
      console.error('Error changing the password:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  // The way out without a new password. The proxy keeps a reset link's
  // session on this page until one is saved, so leaving means ending it.
  const handleCancel = async (): Promise<void> => {
    setError(undefined);
    setIsSaving(true);
    try {
      const result = await signOut();
      if (result.error) {
        setError(result.error);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Error cancelling the reset:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>New password</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isSaving}
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
          disabled={isSaving}
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

      <Button type="submit" disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save password'}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-center"
        disabled={isSaving}
        onClick={() => void handleCancel()}
      >
        Cancel
      </Button>
    </form>
  );
}
