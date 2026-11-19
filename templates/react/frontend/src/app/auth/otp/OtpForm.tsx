import { type FormEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import { sendCode, verifyCode } from './actions';

type Step = 'email' | 'code';

// Where the code the code step waits for came from. Only the most recent one
// sent works, which matters once there has been more than one.
type Sent = 'now' | 'again' | 'earlier';

export default function OtpForm({
  next,
  sentTo,
}: {
  next: string;
  sentTo?: string;
}) {
  const navigate = useNavigate();
  const emailId = useId();
  const codeId = useId();

  // Given the address a code went to, the form starts where the visitor left
  // it: waiting for them to type the code in.
  const [step, setStep] = useState<Step>(sentTo ? 'code' : 'email');
  const [sent, setSent] = useState<Sent>('now');
  const [email, setEmail] = useState(sentTo ?? '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const send = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await sendCode(email, next);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setOtp('');
      setSent(step === 'code' ? 'again' : 'now');
      setStep('code');
    } catch (err) {
      console.error('Error sending the code:', err);
      setError(NETWORK_ERROR);
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

      void navigate(next);
    } catch (err) {
      console.error('Error verifying the code:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  // The link in the code email lands on the email step; sending again from
  // there would replace the code that email holds.
  const haveCode = (): void => {
    setError(undefined);
    setSent('earlier');
    setStep('code');
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
          {sent === 'now' && `We sent a code to ${email}.`}
          {sent === 'again' &&
            `We sent a new code to ${email}. Codes from earlier emails no longer work.`}
          {sent === 'earlier' &&
            `Enter the code from the most recent email we sent to ${email}.`}
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
            // Spaces from a pasted code would fail the pattern before the
            // form ever submits.
            onChange={(event) => setOtp(event.target.value.replace(/\s/g, ''))}
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

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending || !email}
        onClick={haveCode}
      >
        I already have a code
      </Button>
    </form>
  );
}
