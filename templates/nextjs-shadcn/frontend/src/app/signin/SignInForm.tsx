'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { sendOTP, verifyOTP } from '@/app/signin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { localMailboxURL } from '@/lib/nhost/env';

type Step = 'email' | 'otp';

const mailbox = localMailboxURL();

export default function SignInForm() {
  const router = useRouter();
  const emailId = useId();
  const otpId = useId();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOTP = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);

    const result = await sendOTP(email);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStep('otp');
  };

  const handleVerifyOTP = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);

    const result = await verifyOTP(email, otp);

    if (result.error) {
      setIsLoading(false);
      setError(result.error);
      return;
    }

    router.push('/protected');
    router.refresh();
  };

  if (step === 'email') {
    return (
      <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
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
            required
          />
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Sending…' : 'Send code'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={otpId}>Verification code</Label>
        <Input
          id={otpId}
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
          required
        />
        <p className="text-muted-foreground text-sm">
          We sent a code to {email}.
          {mailbox ? (
            <>
              {' '}
              Running locally, so it never leaves your machine:{' '}
              <a
                href={mailbox}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                open the local mailbox
              </a>
              .
            </>
          ) : null}
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Verifying…' : 'Verify'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isLoading}
          onClick={() => {
            setStep('email');
            setOtp('');
            setError(undefined);
          }}
        >
          Use a different email
        </Button>
      </div>
    </form>
  );
}
