'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import {
  sendOTP,
  sendPasswordReset,
  signInWithPassword,
  verifyOTP,
} from '@/app/signin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { localMailboxURL } from '@/lib/nhost/env';

type Method = 'otp' | 'password';
type Step = 'credentials' | 'otp-sent' | 'reset' | 'reset-sent';

const mailbox = localMailboxURL();

function MailboxHint() {
  if (!mailbox) {
    return null;
  }

  return (
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
  );
}

export default function SignInForm() {
  const router = useRouter();
  const emailId = useId();
  const otpId = useId();
  const passwordId = useId();

  const [method, setMethod] = useState<Method>('otp');
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const switchMethod = (next: Method) => {
    setMethod(next);
    setStep('credentials');
    setError(undefined);
    setOtp('');
    setPassword('');
  };

  const finishSignIn = (deleted?: boolean) => {
    router.push(deleted ? '/restore' : '/protected');
    router.refresh();
  };

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

    setStep('otp-sent');
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

    finishSignIn(result.deleted);
  };

  const handlePasswordSignIn = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);

    const result = await signInWithPassword(email, password);

    if (result.error) {
      setIsLoading(false);
      setError(result.error);
      return;
    }

    finishSignIn(result.deleted);
  };

  const handleSendReset = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);

    const result = await sendPasswordReset(email);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStep('reset-sent');
  };

  const emailField = (
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
  );

  if (step === 'otp-sent') {
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
            <MailboxHint />
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
              setStep('credentials');
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

  if (step === 'reset-sent') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          If an account exists for {email}, a password reset link is on its way.
          <MailboxHint />
        </p>
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => switchMethod('password')}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <form onSubmit={handleSendReset} className="flex flex-col gap-4">
        {emailField}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send reset link'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={() => switchMethod('password')}
          >
            Back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={method === 'otp' ? 'default' : 'outline'}
          onClick={() => switchMethod('otp')}
        >
          Email code
        </Button>
        <Button
          type="button"
          size="sm"
          variant={method === 'password' ? 'default' : 'outline'}
          onClick={() => switchMethod('password')}
        >
          Password
        </Button>
      </div>

      {method === 'otp' ? (
        <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
          {emailField}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
          {emailField}

          <div className="flex flex-col gap-2">
            <Label htmlFor={passwordId}>Password</Label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <p className="text-muted-foreground text-sm">
            First time here? Sign in with an email code, then set a password on
            your profile.
          </p>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isLoading}
              onClick={() => {
                setStep('reset');
                setError(undefined);
              }}
            >
              Forgot password?
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
