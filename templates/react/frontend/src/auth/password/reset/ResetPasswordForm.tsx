import { type FormEvent, useId, useState } from 'react';
import { setNewPassword } from '@/auth/password/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/nhost/AuthProvider';

export default function ResetPasswordForm({
  isSaving,
  onSavingChange,
  onChanged,
}: {
  isSaving: boolean;
  onSavingChange: (isSaving: boolean) => void;
  onChanged: () => void;
}) {
  const { nhost } = useAuth();
  const passwordId = useId();
  const confirmId = useId();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    onSavingChange(true);
    try {
      const result = await setNewPassword(nhost, password);
      if (result.error) {
        setError(result.error);
        return;
      }

      onChanged();
    } catch (err) {
      console.error('Error changing the password:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      onSavingChange(false);
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
        />
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save password'}
      </Button>
    </form>
  );
}
