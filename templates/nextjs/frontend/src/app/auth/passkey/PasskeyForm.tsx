'use client';

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import {
  beginSignIn,
  beginSignUp,
  finishSignIn,
  finishSignUp,
} from '@/app/auth/passkey/actions';
import { wasCancelled } from '@/app/auth/passkey/cancelled';
import { rememberPasskey } from '@/app/auth/passkey/thisDevice';
import type { Intent } from '@/app/signin/intent';
import { signInQuery } from '@/app/signin/query';
import CheckYourInbox from '@/components/CheckYourInbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'sign-in' | 'sign-up';

export default function PasskeyForm({
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

  // Opens on whatever the link that sent them here asked for, which is sign-up
  // unless it said otherwise: a fresh local backend has no accounts in it, so a
  // sign-in form would be a dead end.
  const [mode, setMode] = useState<Mode>(intent);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const finishNavigation = (): void => {
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

    if (!browserSupportsWebAuthn()) {
      setError('This browser does not support passkeys.');
      return;
    }

    setIsPending(true);
    try {
      if (mode === 'sign-in') {
        const begun = await beginSignIn();
        if (begun.error || !begun.options) {
          setError(begun.error ?? 'Could not start sign in.');
          return;
        }

        const credential = await startAuthentication({
          optionsJSON: begun.options,
        });
        const result = await finishSignIn(credential);
        if (result.error) {
          setError(result.error);
          return;
        }
        // So the account page knows this device holds it.
        rememberPasskey(credential.id);

        finishNavigation();
        return;
      }

      const begun = await beginSignUp(email, next);
      if (begun.error || !begun.options) {
        setError(begun.error ?? 'Could not start sign up.');
        return;
      }

      const credential = await startRegistration({
        optionsJSON: begun.options,
      });
      const result = await finishSignUp(credential, next);
      if (result.error) {
        setError(result.error);
        return;
      }
      rememberPasskey(credential.id);

      if (result.signedIn) {
        finishNavigation();
        return;
      }

      setSent(true);
    } catch (err) {
      if (wasCancelled(err)) {
        setError('The passkey prompt was cancelled.');
        return;
      }

      console.error('Error completing the passkey ceremony:', err);
      setError('The passkey could not be used. Try again.');
    } finally {
      setIsPending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <CheckYourInbox url={mailboxURL} />
        <p className="text-muted-foreground">
          Your passkey is registered. We sent a verification link to {email}.
          Opening it confirms the address and signs you in.
        </p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {mode === 'sign-up' ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="email webauthn"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isPending}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Your browser will offer the passkeys it holds for this site.
        </p>
      )}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {mode === 'sign-in'
          ? isPending
            ? 'Waiting for your passkey…'
            : 'Sign in with a passkey'
          : isPending
            ? 'Creating your passkey…'
            : 'Create a passkey'}
      </Button>

      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto self-start p-0"
        disabled={isPending}
        onClick={switchMode}
      >
        {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
      </Button>
    </form>
  );
}
