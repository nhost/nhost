'use client';

import { type FormEvent, useId, useState } from 'react';
import { changeEmail, resendVerification } from '@/app/account/actions';
import CheckYourInbox from '@/components/CheckYourInbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// What the field shows once a link has gone out: the next step is in the
// inbox.
type Sent = { kind: 'change'; to: string } | { kind: 'verification' };

/**
 * The email address as the profile shows it, changeable in place.
 *
 * The address is already on the page, so a section of its own lower down was
 * showing it twice. A change still goes through the inbox: the new address
 * only takes effect when the confirmation link is opened.
 */
export default function EmailField({
  email,
  verified,
  mailboxURL,
}: {
  email: string | undefined;
  verified: boolean;
  mailboxURL: string | null;
}) {
  const emailId = useId();

  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [sent, setSent] = useState<Sent | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const stopEditing = (): void => {
    setEditing(false);
    setError(undefined);
    setNewEmail('');
  };

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
      setEditing(false);
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
      <div className="flex flex-col gap-2 text-sm" role="status">
        <CheckYourInbox url={mailboxURL} />
        <p className="text-muted-foreground">
          {sent.kind === 'change'
            ? `We sent a confirmation link to ${sent.to}. The address changes when you open it.`
            : `Another verification link is on its way to ${email}.`}
        </p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2">
        <span className="truncate text-muted-foreground text-sm">
          {email ?? 'No address on this account.'}
          {email ? <> {verified ? '(verified)' : '(not verified)'}</> : null}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
        {email && !verified ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => void handleResend()}
          >
            Resend verification
          </Button>
        ) : null}
        {error ? (
          <p role="alert" className="w-full text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      {/* The current address sits here when the form is closed, so the label
          is for a screen reader rather than for the eye. */}
      <Label htmlFor={emailId} className="sr-only">
        New email
      </Label>
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
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send link'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={stopEditing}
        >
          Cancel
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
