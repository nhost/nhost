'use client';

import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import {
  hasPassword,
  sendOTP,
  sendPasswordReset,
  signInWithPassword,
  verifyOTP,
} from '@/app/signin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { localMailboxURL } from '@/lib/nhost/env';

// Matches the code length auth sends.
const OTP_LENGTH = 6;
const OTP_SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);

// One address, then whichever second step that account actually uses. Nothing
// asks the visitor to know whether they have a password, or whether they have
// an account at all: an unknown address is sent a code, and verifying it
// creates the account.
type Step = 'email' | 'password' | 'code' | 'reset-sent';

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

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const finishSignIn = (deleted?: boolean): void => {
    router.push(deleted ? '/restore' : '/protected');
    router.refresh();
  };

  const backToEmail = (): void => {
    setStep('email');
    setOtp('');
    setPassword('');
    setError(undefined);
  };

  const emailCode = async (): Promise<boolean> => {
    const result = await sendOTP(email);

    if (result.error) {
      setError(result.error);
      return false;
    }

    setStep('code');
    return true;
  };

  const handleContinue = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);

    if (await hasPassword(email)) {
      setStep('password');
      setIsLoading(false);
      return;
    }

    await emailCode();
    setIsLoading(false);
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

  // Submitting the moment the sixth digit lands is the whole point of a code
  // this short, so the button below is only a fallback. Both paths come
  // through here, and the guard keeps them from firing twice on one code.
  const verify = async (code: string): Promise<void> => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(undefined);

    const result = await verifyOTP(email, code);

    if (result.error) {
      setIsLoading(false);
      setError(result.error);
      // Clearing the slots gives them somewhere to type and re-arms
      // onComplete, which only fires on the way up to six.
      setOtp('');
      return;
    }

    finishSignIn(result.deleted);
  };

  const handleVerifyOTP = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    await verify(otp);
  };

  const handleUseCodeInstead = async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    await emailCode();
    setIsLoading(false);
  };

  const handleSendReset = async (): Promise<void> => {
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

  const errorLine = error ? (
    <p className="text-destructive text-sm">{error}</p>
  ) : null;

  const backButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isLoading}
      onClick={backToEmail}
      className="self-start px-2"
    >
      <ArrowLeft aria-hidden />
      {email}
    </Button>
  );

  if (step === 'password') {
    return (
      <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
        {backButton}

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
            autoFocus
          />
        </div>

        {errorLine}

        <Button type="submit" disabled={isLoading || !password}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={handleUseCodeInstead}
          >
            Email me a code instead
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={handleSendReset}
          >
            Forgot password?
          </Button>
        </div>
      </form>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
        {backButton}

        <div className="flex flex-col gap-2">
          <Label htmlFor={otpId}>Verification code</Label>
          <InputOTP
            id={otpId}
            name="otp"
            maxLength={OTP_LENGTH}
            pattern={REGEXP_ONLY_DIGITS}
            autoComplete="one-time-code"
            value={otp}
            onChange={setOtp}
            onComplete={verify}
            disabled={isLoading}
            autoFocus
          >
            <InputOTPGroup>
              {OTP_SLOTS.map((slot) => (
                <InputOTPSlot key={`otp-slot-${slot}`} index={slot} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <p className="text-muted-foreground text-sm">
            We sent a code to {email}.
            <MailboxHint />
          </p>
        </div>

        {errorLine}

        <Button type="submit" disabled={isLoading || otp.length < OTP_LENGTH}>
          {isLoading ? 'Verifying…' : 'Verify'}
        </Button>
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
        {backButton}
      </div>
    );
  }

  return (
    <form onSubmit={handleContinue} className="flex flex-col gap-4">
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

      {errorLine}

      <Button type="submit" disabled={isLoading || !email}>
        {isLoading ? 'Checking…' : 'Continue'}
      </Button>

      <p className="text-muted-foreground text-sm">
        New here? Continue with your email and we will send you a code.
      </p>
    </form>
  );
}
