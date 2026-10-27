'use client';

import { type FormEvent, useId, useState } from 'react';
import { changeEmail, resendVerification } from '@/app/account/actions';
import CheckYourInbox from '@/components/CheckYourInbox';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

// What the dialog shows once a link has gone out: the next step is in the
// inbox.
type Sent = { kind: 'change'; to: string } | { kind: 'verification' };

/**
 * Changing the address, and chasing the verification of the current one.
 *
 * A change is not applied here: the auth service sends a confirmation link
 * to the new address, and the account only moves when that link is opened.
 * So the dialog ends on where the link went rather than closing on a toast,
 * since nothing on the page will have changed yet.
 */
export default function ChangeEmailForm({
  email,
  verified,
  mailboxURL,
}: {
  email: string | undefined;
  verified: boolean;
  mailboxURL: string | null;
}) {
  const emailId = useId();

  const [newEmail, setNewEmail] = useState('');
  const [sent, setSent] = useState<Sent | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      const result = await changeEmail(newEmail);
      if (result.error) {
        setError(result.error);
        return;
      }

      setSent({ kind: 'change', to: newEmail });
      setNewEmail('');
    } catch (err) {
      console.error('Error starting the email change:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await resendVerification();
      if (result.error) {
        setError(result.error);
        return;
      }

      setSent({ kind: 'verification' });
    } catch (err) {
      console.error('Error resending the verification email:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-sm" role="status">
          <CheckYourInbox url={mailboxURL} />
          <p className="text-muted-foreground">
            {sent.kind === 'change'
              ? `We sent a confirmation link to ${sent.to}. The address changes when you open it.`
              : `Another verification link is on its way to ${email}.`}
          </p>
        </div>
        <DialogFooter>
          <DialogClose>Done</DialogClose>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {email && !verified ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <p className="text-destructive text-sm">
            This address has not been verified.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => void handleResend()}
          >
            Resend verification
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>New email</Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
          disabled={isPending}
        />
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose disabled={isPending} />
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !newEmail.includes('@')}
        >
          {isPending ? 'Sending…' : 'Send link'}
        </Button>
      </DialogFooter>
    </form>
  );
}
