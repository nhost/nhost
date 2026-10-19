'use client';

import { type FormEvent, useId, useState } from 'react';
import { changeEmail, resendVerification } from '@/app/account/actions';
import CheckYourInbox from '@/components/CheckYourInbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// What the page shows once a link has gone out: the next step is in the
// inbox.
type Sent = { kind: 'change'; to: string } | { kind: 'verification' };

/**
 * Changing the address, and chasing the verification of the current one.
 *
 * A change is not applied here: the auth service sends a confirmation link
 * to the new address, and the account only moves when that link is opened.
 * Which is the reason this is a page of its own rather than a field on the
 * profile, where an edit that visibly changes nothing reads as a failure.
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
      setError('The request did not reach the server. Try again.');
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
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-2 text-center text-sm" role="status">
        <CheckYourInbox url={mailboxURL} />
        <p className="text-muted-foreground">
          {sent.kind === 'change'
            ? `We sent a confirmation link to ${sent.to}. The address changes when you open it.`
            : `Another verification link is on its way to ${email}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {email && !verified ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
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

      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <Label htmlFor={emailId}>New email</Label>
        <div className="flex items-center gap-2">
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            required
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            disabled={isPending}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Sending…' : 'Send link'}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
