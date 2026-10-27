'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import {
  requestPasswordReset,
  signIn,
  signUp,
  verifyMfa,
} from '@/app/auth/password/actions';
import PasswordRequirements from '@/app/auth/password/PasswordRequirements';
import type { Intent } from '@/app/signin/intent';
import { signInQuery } from '@/app/signin/query';
import CheckYourInbox from '@/components/CheckYourInbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

type Mode = 'sign-in' | 'sign-up';

// What the form shows once a request has gone out and there is nothing more
// to type: the next step happens in the visitor's inbox.
type Sent = 'verification' | 'reset';

export default function PasswordForm({
  next,
  intent,
  mailboxURL,
}: {
  next: string;
  intent: Intent;
  mailboxURL: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();
  const rulesId = useId();

  // Opens on whatever the link that sent them here asked for, which is sign-up
  // unless it said otherwise: a fresh local backend has no accounts in it, so
  // a sign-in form would be a dead end.
  const [mode, setMode] = useState<Mode>(intent);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState<Sent | undefined>();
  // Set when the password was right but the account has two-factor on: the
  // backend wants a code from the authenticator app before it issues a session.
  const [mfaTicket, setMfaTicket] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const finishSignIn = (): void => {
    router.push(next);
    router.refresh();
  };

  const switchMode = (): void => {
    const other = mode === 'sign-in' ? 'sign-up' : 'sign-in';
    setMode(other);
    setError(undefined);
    // "Other ways to sign in" is built from the URL, so the URL has to say
    // which mode the visitor switched to.
    router.replace(`${pathname}${signInQuery(next, other)}`, { scroll: false });
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      if (mode === 'sign-in') {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
          return;
        }

        if (result.mfaTicket) {
          setMfaTicket(result.mfaTicket);
          return;
        }

        finishSignIn();
        return;
      }

      const result = await signUp(email, password, next);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.signedIn) {
        finishSignIn();
        return;
      }

      setSent('verification');
    } catch (err) {
      console.error('Error submitting the form:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      const result = await verifyMfa(mfaTicket ?? '', code);
      if (result.error) {
        setError(result.error);
        return;
      }

      finishSignIn();
    } catch (err) {
      console.error('Error verifying the code:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  // Keeps the email: going back is usually for the same account, with the
  // ticket lapsed or the authenticator not to hand.
  const startOver = (): void => {
    setMfaTicket(undefined);
    setCode('');
    setPassword('');
    setError(undefined);
  };

  const handleForgotPassword = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await requestPasswordReset(email);
      if (result.error) {
        setError(result.error);
        return;
      }

      setSent('reset');
    } catch (err) {
      console.error('Error requesting the reset link:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  if (sent === 'verification') {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <CheckYourInbox url={mailboxURL} />
        <p className="text-muted-foreground">
          We sent a verification link to {email}. Opening it confirms the
          address and signs you in.
        </p>
      </div>
    );
  }

  if (sent === 'reset') {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <CheckYourInbox url={mailboxURL} />
        <p className="text-muted-foreground">
          If that address has an account, a reset link is on its way.
        </p>
      </div>
    );
  }

  if (mfaTicket) {
    return (
      <form className="flex flex-col gap-4" onSubmit={handleVerifyCode}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={codeId}>Authenticator code</Label>
          <Input
            id={codeId}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={isPending}
          />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Verifying…' : 'Verify'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={isPending}
          onClick={startOver}
        >
          Start over
        </Button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>Password</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete={
            mode === 'sign-in' ? 'current-password' : 'new-password'
          }
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          aria-describedby={mode === 'sign-up' ? rulesId : undefined}
        />
        {/* Only while signing up. Signing in, the password already exists,
            and whether it would pass today's rules is not the question. */}
        {mode === 'sign-up' ? (
          <PasswordRequirements id={rulesId} password={password} />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {mode === 'sign-in'
          ? isPending
            ? 'Signing in…'
            : 'Sign in'
          : isPending
            ? 'Signing up…'
            : 'Sign up'}
      </Button>

      {/* Centred, not spread: signing up there is only one link here, and
          justify-between left it hard against the left edge of a card whose
          heading and button are both centred. Signing in, the two sit
          together in the middle instead of at opposite ends. */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          disabled={isPending}
          onClick={switchMode}
        >
          {mode === 'sign-in'
            ? 'Create an account'
            : 'I already have an account'}
        </Button>
        {mode === 'sign-in' ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            disabled={isPending || !email}
            onClick={() => void handleForgotPassword()}
          >
            Forgot your password?
          </Button>
        ) : null}
      </div>
    </form>
  );
}
