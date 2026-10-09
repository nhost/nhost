import { type FormEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { requestPasswordReset, signIn, signUp } from '@/auth/password/actions';
import CheckYourInbox from '@/components/CheckYourInbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/nhost/AuthProvider';
import type { Intent } from '@/signin/intent';
import { signInQuery } from '@/signin/query';

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
  const { nhost } = useAuth();
  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();

  // Opens on whatever the link that sent them here asked for, which is sign-up
  // unless it said otherwise: a fresh local backend has no accounts in it, so
  // a sign-in form would be a dead end.
  const [mode, setMode] = useState<Mode>(intent);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState<Sent | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const switchMode = (): void => {
    const other = mode === 'sign-in' ? 'sign-up' : 'sign-in';
    setMode(other);
    setError(undefined);
    // "Other ways to sign in" is built from the URL, so the URL has to say
    // which mode the visitor switched to.
    void navigate({ search: signInQuery(next, other) }, { replace: true });
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      if (mode === 'sign-in') {
        const result = await signIn(nhost, email, password);
        if (result.error) {
          setError(result.error);
          return;
        }

        void navigate(next);
        return;
      }

      const result = await signUp(nhost, email, password, next);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.signedIn) {
        void navigate(next);
        return;
      }

      setSent('verification');
    } catch (err) {
      console.error('Error submitting the form:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await requestPasswordReset(nhost, email);
      if (result.error) {
        setError(result.error);
        return;
      }

      setSent('reset');
    } catch (err) {
      console.error('Error requesting the reset link:', err);
      setError('The request did not reach the server. Try again.');
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
        />
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
