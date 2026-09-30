'use client';

import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendMagicLink } from './actions';

export default function MagicLinkForm({
  next,
  mailboxURL,
}: {
  next: string;
  mailboxURL: string | null;
}) {
  const emailId = useId();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsSending(true);
    try {
      const result = await sendMagicLink(email, next);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setSent(true);
    } catch (err) {
      console.error('Error sending the magic link:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  const useDifferentAddress = (): void => {
    setSent(false);
    setEmail('');
    setError(undefined);
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          A sign-in link is on its way to {email}. Opening it signs you in on
          this device.
        </p>
        {mailboxURL ? (
          <p className="text-muted-foreground text-sm">
            Running locally? The email is in the{' '}
            <a
              href={mailboxURL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              local mailbox
            </a>
            .
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={useDifferentAddress}
          className="self-start"
        >
          Use a different address
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSending}
          required
        />
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isSending || !email}>
        {isSending ? 'Sending…' : 'Send me a link'}
      </Button>
    </form>
  );
}
