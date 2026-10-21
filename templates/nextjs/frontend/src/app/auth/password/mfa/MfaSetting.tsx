'use client';

import type { User } from '@nhost/nhost-js/auth';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import {
  disableMfa,
  enableMfa,
  generateMfa,
  type MfaSetup,
} from '@/app/auth/password/mfa/actions';
import { ExpandableSetting, useSettingOpen } from '@/components/Setting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const NETWORK_ERROR = 'The request did not reach the server. Try again.';

/**
 * Two-factor, as a row on the account page.
 *
 * The auth service turns it on only once a code from the app proves the app
 * holds the secret, and turns it off only with a current code, so opening
 * the row is the first step either way. Opened while it is off, the row asks
 * for a secret straight away, since showing the QR code is the only thing
 * there is to do.
 */
export default function MfaSetting({ user }: { user: User }) {
  const active = user.activeMfaType === 'totp';
  const router = useRouter();
  const rowId = useId();
  const codeId = useId();
  const hintId = useId();

  const [, setOpen] = useSettingOpen(rowId);
  // Which way the row was opened. Kept apart from `active` so the form stays
  // as it was while the row slides shut, rather than flipping to the other
  // one the moment the page comes back with the new state.
  const [turningOff, setTurningOff] = useState(active);
  const [setup, setSetup] = useState<MfaSetup | undefined>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const start = async (): Promise<void> => {
    setIsPending(true);
    try {
      const result = await generateMfa();
      if (result.error || !result.setup) {
        setError(result.error ?? 'Could not start the setup.');
        return;
      }

      setSetup(result.setup);
    } catch (err) {
      console.error('Error starting the two-factor setup:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const handleOpen = (): void => {
    setCode('');
    setError(undefined);
    setTurningOff(active);
    // A fresh secret on every opening. The backend stores it on the account
    // right away, and one shown earlier and closed is not worth keeping.
    if (!active) {
      setSetup(undefined);
      void start();
    }
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      const result = turningOff
        ? await disableMfa(code)
        : await enableMfa(code);
      if (result.error) {
        setError(result.error);
        return;
      }

      // The page reads the account's state from the auth service, so the
      // row's description changes when it is rendered again rather than
      // being guessed at here.
      setOpen(false);
      setCode('');
      router.refresh();
    } catch (err) {
      console.error('Error changing two-factor:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const alert = error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;

  let body: ReactNode = null;
  if (turningOff) {
    body = (
      <p className="text-center text-sm">
        Enter a current code from your app to turn it off.
      </p>
    );
  } else if (setup) {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm">
          Scan this with an authenticator app, then enter the code it shows.
        </p>
        {/* biome-ignore lint/performance/noImgElement: a data URL the auth service just generated, nothing for next/image to optimise */}
        <img
          src={setup.imageUrl}
          alt="QR code for the authenticator app"
          width={200}
          height={200}
          className="size-50 rounded-md border bg-white"
        />
        <p className="text-muted-foreground text-sm">
          Or enter this key by hand:{' '}
          <code className="break-all font-mono text-xs">
            {setup.totpSecret}
          </code>
        </p>
      </div>
    );
  } else if (isPending) {
    body = (
      <p className="text-muted-foreground text-sm">Preparing a code to scan…</p>
    );
  }

  const ready = turningOff || setup !== undefined;

  return (
    <ExpandableSetting
      id={rowId}
      label="Two-factor"
      value={active ? 'On' : 'Off'}
      action={active ? 'Manage' : 'Turn on'}
      onOpen={handleOpen}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {body}

        {ready ? (
          // Narrow and centred under the code to scan: six digits do not
          // need the row's width.
          <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
            <Label htmlFor={codeId}>Authenticator code</Label>
            <div className="flex items-center gap-2">
              <Input
                id={codeId}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={isPending}
                aria-describedby={turningOff ? undefined : hintId}
                className="min-w-0 flex-1 text-center tracking-widest"
              />
              {turningOff ? (
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isPending}
                >
                  {isPending ? 'Turning off…' : 'Turn off'}
                </Button>
              ) : (
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Turning on…' : 'Turn on'}
                </Button>
              )}
            </div>
            {/* What it covers, under the field it is about, since the
                answer to "will this lock me out of X" is no for everything
                but the password. */}
            {turningOff ? null : (
              <p id={hintId} className="text-muted-foreground text-sm">
                Only signing in with your password will ask for this code. Other
                sign-in methods and links sent by email, including password
                reset, won't.
              </p>
            )}
          </div>
        ) : null}

        {alert}
      </form>
    </ExpandableSetting>
  );
}
