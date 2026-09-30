'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendCode, verifyCode } from './actions';

type Step = 'email' | 'code';

export default function OtpForm({
  next,
  mailboxURL,
}: {
  next: string;
  mailboxURL: string | null;
}) {
  const router = useRouter();
  const emailId = useId();
  const codeId = useId();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const send = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await sendCode(email);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setOtp('');
      setStep('code');
    } catch (err) {
      console.error('Error sending the code:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  const handleSend = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await send();
  };

  const handleVerify = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      const result = await verifyCode(email, otp);
      if (result?.error) {
        setError(result.error);
        return;
      }

      // The action already wrote the session cookie; refresh so the server
      // components render against it.
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error('Error verifying the code:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  const backToEmail = (): void => {
    setStep('email');
    setOtp('');
    setError(undefined);
  };

  const errorLine = error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;

  if (step === 'code') {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          We sent a code to {email}.
          {mailboxURL ? (
            <>
              {' '}
              Locally it lands in the{' '}
              <a
                href={mailboxURL}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                mailbox
              </a>
              .
            </>
          ) : null}
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor={codeId}>Code</Label>
          <Input
            id={codeId}
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            disabled={isPending}
            required
            autoFocus
          />
        </div>

        {errorLine}

        <Button type="submit" disabled={isPending || !otp}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => void send()}
          >
            Send a new code
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={backToEmail}
          >
            Use a different address
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSend} className="flex flex-col gap-4">
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
          disabled={isPending}
          required
        />
      </div>

      {errorLine}

      <Button type="submit" disabled={isPending || !email}>
        {isPending ? 'Sending…' : 'Send me a code'}
      </Button>
    </form>
  );
}
