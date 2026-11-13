'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { changePassword } from '@/app/account/actions';
import PasswordChanged from '@/app/auth/password/PasswordChanged';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements';
import { passwordRequirements } from '@/app/auth/password/requirements';
import { DialogClose, DialogFooter, useCloseDialog } from '@/components/Dialog';
import { useReplacePage } from '@/components/ReplacePageLayout';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

/**
 * `needsCode` is for an account with two-factor on: signing this browser back
 * in with the new password takes a current code from the authenticator app too,
 * so the form asks for one alongside it.
 */
export default function ChangePasswordForm({
  needsCode = false,
}: {
  needsCode?: boolean;
}) {
  const replacePage = useReplacePage();
  const router = useRouter();
  const toast = useToast();
  const close = useCloseDialog();
  const passwordId = useId();
  const confirmId = useId();
  const rulesId = useId();
  const codeId = useId();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const ready =
    passwordRequirements(password, confirm).every((rule) => rule.met) &&
    (!needsCode || /^\d{6}$/.test(code.trim()));

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setIsPending(true);
    try {
      const result = await changePassword(
        password,
        needsCode ? code.trim() : undefined,
      );
      if (result.error) {
        setError(result.error);
        return;
      }

      // Signed back in, so the page stays: only the other devices lost
      // their session, and the session list under this is re-read.
      if (result.signedIn) {
        close();
        toast('Password changed');
        router.refresh();
        return;
      }

      replacePage(<PasswordChanged />);
    } catch (err) {
      console.error('Error changing the password:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  return (
    // What changing it costs is the dialog's description, above this.
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">
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
          className="flex-row flex-wrap items-start gap-x-4 text-xs"
        />

        {needsCode ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={codeId}>Authenticator code</Label>
            <Input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isPending}
              className="font-mono tracking-widest"
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose disabled={isPending} />
        <Button type="submit" size="sm" disabled={isPending || !ready}>
          {isPending ? 'Changing…' : 'Change password'}
        </Button>
      </DialogFooter>
    </form>
  );
}
