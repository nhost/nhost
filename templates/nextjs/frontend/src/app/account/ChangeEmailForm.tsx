'use client';

import { type FormEvent, useId, useState } from 'react';
import { changeEmail, resendVerification } from '@/app/account/actions';
import CheckYourInbox from '@/components/CheckYourInbox';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// What the card shows once a link has gone out: the next step is in the inbox.
type Sent = { kind: 'change'; to: string } | { kind: 'verification' };

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>
          {email ?? 'No address on this account.'}
          {email ? (
            <span> {verified ? '(verified)' : '(not verified)'}</span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sent ? (
          <div className="flex flex-col gap-2 text-sm" role="status">
            <CheckYourInbox url={mailboxURL} />
            <p className="text-muted-foreground">
              {sent.kind === 'change'
                ? `We sent a confirmation link to ${sent.to}. The address changes when you open it.`
                : `Another verification link is on its way to ${email}.`}
            </p>
          </div>
        ) : (
          <>
            {email && !verified ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={isPending}
                onClick={() => void handleResend()}
              >
                Resend verification email
              </Button>
            ) : null}

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor={emailId}>New email</Label>
                <Input
                  id={emailId}
                  type="email"
                  autoComplete="email"
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

              <Button type="submit" disabled={isPending} className="self-start">
                {isPending ? 'Sending…' : 'Change email'}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
